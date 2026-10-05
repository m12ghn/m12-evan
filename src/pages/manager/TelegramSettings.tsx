import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { telegramApi } from '../../lib/notify';

interface Cfg { enabled: boolean; default_chat: string; checkin_chat: string; refuel_chat: string; checkout_chat: string }
interface Log { id: number; at: string; event: string; chat_id: string | null; status: 'pending' | 'sent' | 'failed'; error: string | null }
interface Status { tokenConfigured: boolean; bot?: string; tokenError?: string }

const EMPTY: Cfg = { enabled: false, default_chat: '', checkin_chat: '', refuel_chat: '', checkout_chat: '' };
const EVENT: Record<string, string> = { checkin: 'Vào ca', refuel: 'Sạc điện / đổ nhiên liệu', checkout: 'Kết thúc ca', test: 'Tin thử' };
const validChat = (s: string) => s === '' || /^-?\d{5,}$/.test(s) || /^@\w{4,}$/.test(s);

export default function TelegramSettings() {
  const [cfg, setCfg] = useState<Cfg>(EMPTY);
  const [status, setStatus] = useState<Status | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    const { data } = await supabase.from('telegram_log').select('*').order('at', { ascending: false }).limit(15);
    setLogs((data as Log[]) ?? []);
  }, []);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'telegram').maybeSingle()
      .then(({ data }) => setCfg({ ...EMPTY, ...((data?.value as Partial<Cfg>) ?? {}) }));
    telegramApi<Status>({ action: 'status' }).then(setStatus).catch(e => setStatus({ tokenConfigured: false, tokenError: e.message }));
    loadLogs();
  }, [loadLogs]);

  const set = (k: keyof Cfg, v: string | boolean) => setCfg({ ...cfg, [k]: v });
  const wrap = async (name: string, fn: () => Promise<string | void>) => {
    setBusy(name); setError(''); setMsg('');
    try { const m = await fn(); if (m) setMsg(m); } catch (e) { setError((e as Error).message); }
    setBusy('');
  };

  const chats: [keyof Cfg, string][] = [['checkin_chat', 'Chat ID — Vào ca'], ['refuel_chat', 'Chat ID — Sạc điện / đổ nhiên liệu'], ['checkout_chat', 'Chat ID — Kết thúc ca']];
  const allValid = [cfg.default_chat, cfg.checkin_chat, cfg.refuel_chat, cfg.checkout_chat].every(validChat);

  const save = () => wrap('save', async () => {
    const { error: e } = await supabase.from('app_settings').upsert({ key: 'telegram', value: cfg, updated_at: new Date().toISOString() });
    if (e) throw e;
    return 'Đã lưu cài đặt Telegram';
  });
  const test = (chat: string) => wrap('test', async () => {
    if (!chat) throw new Error('Nhập Chat ID trước khi gửi thử');
    await telegramApi({ action: 'test', chat_id: chat }); await loadLogs();
    return 'Đã gửi tin thử — kiểm tra nhóm Telegram';
  });
  const sweep = () => wrap('sweep', async () => {
    let ok = 0, failed = 0, remaining = 1;
    for (let i = 0; i < 12 && remaining > 0; i++) {
      const r = await telegramApi<{ ok?: number; failed?: number; remaining?: number }>({ action: 'sweep', hours: 48 });
      ok += r.ok ?? 0; failed += r.failed ?? 0; remaining = r.remaining ?? 0;
      if (!r.ok && !r.failed) break;
    }
    await loadLogs();
    return `Quét 48 giờ gần nhất: gửi bù ${ok} tin${failed ? `, lỗi ${failed}` : ''}${remaining ? `, còn ${remaining} chưa gửi (bấm lại)` : ''}.`;
  });
  const resend = (id: number) => wrap('resend', async () => {
    const r = await telegramApi<{ ok?: boolean; failed?: boolean; error?: string }>({ action: 'resend', log_id: id });
    await loadLogs();
    if (r.failed) throw new Error(r.error ?? 'Gửi lại thất bại');
    return 'Đã gửi lại';
  });

  return (
    <div className="card stack">
      <h3>✈️ Thông báo Telegram</h3>
      <p className="muted">Khi tài xế vào ca, sạc điện / đổ nhiên liệu, kết thúc ca, bot tự gửi tin theo mẫu kèm ảnh vào nhóm Telegram.</p>

      {status === null ? <p className="muted">Đang kiểm tra bot…</p>
        : status.tokenConfigured && !status.tokenError ? <p style={{ color: 'var(--success)' }}>✓ Bot đã kết nối: <b>@{status.bot}</b></p>
        : <p className="error">⚠️ {status.tokenError ? `Token không hợp lệ: ${status.tokenError}` : <>Chưa có token bot. Vào Vercel → Settings → Environment Variables, thêm biến <code>TELEGRAM_BOT_TOKEN</code> (Sensitive), rồi Redeploy.</>}</p>}

      <label className="row"><input type="checkbox" checked={cfg.enabled} onChange={e => set('enabled', e.target.checked)} /> Bật gửi tin Telegram</label>

      <div className="form-grid">
        <label>Chat ID mặc định (dùng cho mọi loại tin)
          <div className="row"><input value={cfg.default_chat} placeholder="-1001234567890" onChange={e => set('default_chat', e.target.value.trim())} style={{ flex: 1 }} />
            <button className="btn ghost" disabled={busy !== ''} onClick={() => test(cfg.default_chat)}>Gửi thử</button></div></label>
        {chats.map(([k, label]) => (
          <label key={k}>{label} <span className="muted">(để trống = dùng mặc định)</span>
            <div className="row"><input value={cfg[k] as string} placeholder="-100…" onChange={e => set(k, e.target.value.trim())} style={{ flex: 1 }} />
              <button className="btn ghost" disabled={busy !== ''} onClick={() => test((cfg[k] as string) || cfg.default_chat)}>Gửi thử</button></div></label>
        ))}
      </div>
      {!allValid && <p className="error">Chat ID chỉ gồm số (nhóm thường bắt đầu bằng -100…) hoặc @tên_kênh</p>}
      <p className="muted">Cách lấy Chat ID: thêm bot vào nhóm, gửi một tin bất kỳ, rồi thêm tạm bot <b>@RawDataBot</b> vào nhóm để xem số "chat id" (dạng -100…), xong có thể xóa bot đó khỏi nhóm.</p>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn" disabled={busy !== '' || !allValid} onClick={save}>{busy === 'save' ? 'Đang lưu…' : 'Lưu cài đặt'}</button>
        <button className="btn ghost" disabled={busy !== ''} onClick={sweep}>{busy === 'sweep' ? 'Đang gửi bù…' : '↻ Quét & gửi bù (48 giờ qua)'}</button>
      </div>
      {error && <p className="error">{error}</p>}{msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}

      <h4>Tin gần đây</h4>
      <div className="scroll"><table>
        <thead><tr><th>Giờ</th><th>Loại</th><th>Nhóm</th><th>Kết quả</th><th></th></tr></thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.id}>
              <td>{new Date(l.at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td>{EVENT[l.event] ?? l.event}</td><td>{l.chat_id}</td>
              <td>{l.status === 'sent' ? '✓ Đã gửi' : l.status === 'pending' ? '⏳ Đang gửi' : <span className="error">✗ {l.error}</span>}</td>
              <td>{l.status === 'failed' && l.event !== 'test' && <button className="btn ghost" disabled={busy !== ''} onClick={() => resend(l.id)}>Gửi lại</button>}</td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={5} className="muted">Chưa có tin nào</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}
