import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { telegramApi } from '../../lib/notify';

interface Cfg { enabled: boolean; default_chat: string; checkin_chat: string; refuel_chat: string; checkout_chat: string; since?: string }
interface Log { id: number; at: string; event: string; chat_id: string | null; status: 'pending' | 'sent' | 'failed' | 'skipped'; error: string | null }
interface Status { tokenConfigured: boolean; bot?: string; tokenError?: string }
interface Hook { configured: boolean; url: string | null; pg_net: boolean; cron: boolean }

const EMPTY: Cfg = { enabled: false, default_chat: '', checkin_chat: '', refuel_chat: '', checkout_chat: '' };
const EVENT: Record<string, string> = { checkin: 'Vào ca', refuel: 'Sạc điện / đổ nhiên liệu', checkout: 'Kết thúc ca', test: 'Tin thử' };
// Chat ID: -100… ; nhóm có chủ đề (topic) thêm _mã_topic, vd -1003936059980_8 ; hoặc @tên_kênh
const validChat = (s: string) => s === '' || /^-?\d{5,}(_\d+)?$/.test(s) || /^@\w{4,}$/.test(s);

export default function TelegramSettings() {
  const [cfg, setCfg] = useState<Cfg>(EMPTY);
  const [status, setStatus] = useState<Status | null>(null);
  const [hook, setHook] = useState<Hook | null>(null);
  const [hookSecret, setHookSecret] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    const { data } = await supabase.from('telegram_log').select('*').order('at', { ascending: false }).limit(15);
    setLogs((data as Log[]) ?? []);
  }, []);

  const loadHook = useCallback(async () => {
    const { data } = await supabase.rpc('telegram_hook_status');
    setHook((data as Hook | null) ?? null);
  }, []);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'telegram').maybeSingle()
      .then(({ data }) => setCfg({ ...EMPTY, ...((data?.value as Partial<Cfg>) ?? {}) }));
    telegramApi<Status>({ action: 'status' }).then(setStatus).catch(e => setStatus({ tokenConfigured: false, tokenError: e.message }));
    loadLogs(); loadHook();
  }, [loadLogs, loadHook]);

  const set = (k: keyof Cfg, v: string | boolean) => setCfg({ ...cfg, [k]: v });
  const wrap = async (name: string, fn: () => Promise<string | void>) => {
    setBusy(name); setError(''); setMsg('');
    try { const m = await fn(); if (m) setMsg(m); } catch (e) { setError((e as Error).message); }
    setBusy('');
  };

  const chats: [keyof Cfg, string][] = [['checkin_chat', 'Chat ID — Vào ca'], ['refuel_chat', 'Chat ID — Sạc điện / đổ nhiên liệu'], ['checkout_chat', 'Chat ID — Kết thúc ca']];
  const allValid = [cfg.default_chat, cfg.checkin_chat, cfg.refuel_chat, cfg.checkout_chat].every(validChat);

  const save = () => wrap('save', async () => {
    // Lần đầu bật (hoặc chưa có mốc) → chỉ gửi các tin phát sinh từ bây giờ, không gửi lại lịch sử
    const value = { ...cfg, since: cfg.since && cfg.enabled ? cfg.since : new Date().toISOString() };
    const { error: e } = await supabase.from('app_settings').upsert({ key: 'telegram', value, updated_at: new Date().toISOString() });
    if (e) throw e;
    setCfg(value);
    return 'Đã lưu cài đặt Telegram';
  });
  const resetSince = () => wrap('since', async () => {
    const value = { ...cfg, since: new Date().toISOString() };
    const { error: e } = await supabase.from('app_settings').upsert({ key: 'telegram', value, updated_at: new Date().toISOString() });
    if (e) throw e;
    setCfg(value);
    return 'Xong. Từ bây giờ chỉ gửi các tin mới; lịch sử cũ sẽ không bị gửi.';
  });
  const test = (chat: string) => wrap('test', async () => {
    if (!chat) throw new Error('Nhập Chat ID trước khi gửi thử');
    await telegramApi({ action: 'test', chat_id: chat }); await loadLogs();
    return 'Đã gửi tin thử — kiểm tra nhóm Telegram';
  });
  const sweep = () => wrap('sweep', async () => {
    let ok = 0, failed = 0, remaining = 1;
    for (let i = 0; i < 12 && remaining > 0; i++) {
      const r = await telegramApi<{ ok?: number; failed?: number; remaining?: number }>({ action: 'sweep', hours: 2 });
      ok += r.ok ?? 0; failed += r.failed ?? 0; remaining = r.remaining ?? 0;
      if (!r.ok && !r.failed) break;
    }
    await loadLogs();
    return `Quét 2 giờ gần nhất: gửi bù ${ok} tin${failed ? `, lỗi ${failed}` : ''}${remaining ? `, còn ${remaining} chưa gửi (bấm lại)` : ''}.`;
  });
  const hookUrl = `${window.location.origin}/api/telegram-hook`;
  const genSecret = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    setHookSecret(Array.from(bytes, b => chars[b % chars.length]).join(''));
  };
  const saveHook = () => wrap('hook', async () => {
    const { error: e } = await supabase.rpc('set_telegram_hook', { p_url: hookUrl, p_secret: hookSecret });
    if (e) throw e;
    await loadHook();
    return 'Đã lưu kết nối tự động. Nhớ đặt ĐÚNG mã này vào biến TELEGRAM_HOOK_SECRET trên Vercel (rồi Redeploy), sau đó bấm "Kiểm tra kết nối".';
  });
  const pingHook = () => wrap('ping', async () => {
    const r = await fetch(hookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hookSecret}` }, body: JSON.stringify({ action: 'ping' }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 503) throw new Error('Vercel chưa có biến TELEGRAM_HOOK_SECRET (hoặc chưa Redeploy).');
    if (r.status === 401) throw new Error('Mã bí mật không khớp với biến TELEGRAM_HOOK_SECRET trên Vercel.');
    if (!r.ok) throw new Error((j as { error?: string }).error ?? `Lỗi ${r.status}`);
    return '✓ Kết nối tốt: máy chủ nhận đúng mã bí mật.';
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
      {!allValid && <p className="error">Chat ID chỉ gồm số (bắt đầu bằng -100…), có thể thêm _mã_topic ở cuối (vd -1003936059980_8), hoặc @tên_kênh</p>}
      <p className="muted">Nhóm có <b>chủ đề (topic)</b>: nhập <code>-100…_mã_topic</code>, ví dụ <code>-1003936059980_8</code> thì tin vào đúng chủ đề số 8. Mỗi loại tin có thể vào một chủ đề khác nhau.</p>
      <p className="muted">Cách lấy Chat ID: thêm bot vào nhóm, gửi một tin bất kỳ, rồi thêm tạm bot <b>@RawDataBot</b> vào nhóm để xem số "chat id" (dạng -100…), xong có thể xóa bot đó khỏi nhóm.</p>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn" disabled={busy !== '' || !allValid} onClick={save}>{busy === 'save' ? 'Đang lưu…' : 'Lưu cài đặt'}</button>
        <button className="btn ghost" disabled={busy !== ''} onClick={sweep}>{busy === 'sweep' ? 'Đang gửi bù…' : '↻ Quét & gửi bù (2 giờ qua)'}</button>
        <button className="btn ghost" disabled={busy !== ''} onClick={resetSince}>⏱ Chỉ gửi tin mới từ bây giờ</button>
      </div>
      {error && <p className="error">{error}</p>}{msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}

      <h4>⚡ Gửi tự động ngay khi có dữ liệu mới</h4>
      {hook === null ? <p className="muted">Đang kiểm tra…</p> : (
        <>
          {hook.configured
            ? <p style={{ color: 'var(--success)' }}>✓ Đã bật: database tự báo cho máy chủ ngay khi tài xế lưu ca / phiếu (không phụ thuộc điện thoại tài xế). Địa chỉ: <code>{hook.url}</code></p>
            : <p className="error">Chưa bật. Làm 3 bước bên dưới để database tự gửi tin ngay khi có dữ liệu mới. (Trong lúc chưa bật, tin vẫn được gửi từ điện thoại tài xế.)</p>}
          {!hook.pg_net && <p className="error">⚠️ Extension <b>pg_net</b> chưa bật: vào Supabase → Database → Extensions → bật pg_net.</p>}
          {hook.configured && !hook.cron && <p className="muted">Lưu ý: chưa bật <b>pg_cron</b> nên chưa có quét bù tự động mỗi 5 phút (tin vẫn gửi ngay nhờ trigger). Bật tại Database → Extensions → pg_cron rồi chạy lại migration 009.</p>}
          <ol className="muted" style={{ paddingLeft: 20, margin: 0 }}>
            <li>Bấm <b>Tạo mã ngẫu nhiên</b>, sao chép mã.</li>
            <li>Vercel → Settings → Environment Variables: thêm <code>TELEGRAM_HOOK_SECRET</code> = mã đó (Sensitive) → Redeploy.</li>
            <li>Quay lại đây bấm <b>Lưu kết nối tự động</b>, rồi <b>Kiểm tra kết nối</b>.</li>
          </ol>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <input value={hookSecret} placeholder="Mã bí mật (tối thiểu 16 ký tự)" onChange={e => setHookSecret(e.target.value.trim())} style={{ flex: 1, minWidth: 220 }} />
            <button className="btn ghost" disabled={busy !== ''} onClick={genSecret}>Tạo mã ngẫu nhiên</button>
            <button className="btn ghost" disabled={!hookSecret} onClick={() => navigator.clipboard?.writeText(hookSecret)}>Sao chép</button>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn" disabled={busy !== '' || hookSecret.length < 16} onClick={saveHook}>{busy === 'hook' ? 'Đang lưu…' : 'Lưu kết nối tự động'}</button>
            <button className="btn ghost" disabled={busy !== '' || hookSecret.length < 16} onClick={pingHook}>{busy === 'ping' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}</button>
          </div>
        </>
      )}

      <h4>Tin gần đây</h4>
      <div className="scroll"><table>
        <thead><tr><th>Giờ</th><th>Loại</th><th>Nhóm</th><th>Kết quả</th><th></th></tr></thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.id}>
              <td>{new Date(l.at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td>{EVENT[l.event] ?? l.event}</td><td>{l.chat_id}</td>
              <td>{l.status === 'sent' ? '✓ Đã gửi' : l.status === 'pending' ? '⏳ Đang gửi' : l.status === 'skipped' ? <span style={{ color: 'var(--warning)' }}>⏸ Chưa gửi: {l.error}</span> : <span className="error">✗ {l.error}</span>}</td>
              <td>{(l.status === 'failed' || l.status === 'skipped') && l.event !== 'test' && <button className="btn ghost" disabled={busy !== ''} onClick={() => resend(l.id)}>Gửi lại</button>}</td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={5} className="muted">Chưa có tin nào</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}
