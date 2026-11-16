import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { readXlsxSheet } from '../../lib/excel';
import { syncBtbd } from '../../lib/btbdApi';
import { normPlate, parseKm, SERVICE_LABEL, serviceLeft, serviceState } from '../../lib/service';
import type { Lookups } from '../../lib/useLookups';

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
interface Change { id: string; plate: string; odo: number; oldNext: number | null; next: number; sheetLeft: number | null; notice: string | null }

// Cập nhật mốc bảo dưỡng định kỳ (BTBD) từ file Excel tải về từ sheet "Data BTBD": khớp theo biển số (bỏ dấu - và khoảng trắng)
export default function BulkService({ lk }: { lk: Lookups }) {
  const [changes, setChanges] = useState<Change[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [file, setFile] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [syncing, setSyncing] = useState(false);
  const lastSync = lk.vehicles.map(v => v.service_synced_at).filter(Boolean).sort().pop();

  async function onFile(f: File) {
    setMsg(''); setError(''); setChanges([]); setUnmatched([]); setInfo(''); setFile(f.name);
    let res;
    try {
      res = await readXlsxSheet(f, hs => hs.some(h => plain(h) === 'bien so') && hs.some(h => /dinh k[iy] tiep theo/.test(plain(h))));
    } catch { setError('Không đọc được file. Hãy tải sheet "Data BTBD" về dạng .xlsx (Google Sheets: Tệp → Tải xuống → Microsoft Excel).'); return; }
    if (!res) { setError('Không thấy sheet nào có cột "Biển số" và "Km BD định kì tiếp theo". Hãy tải file Excel của sheet "Data BTBD".'); return; }
    const hs = Object.keys(res.rows[0]);
    const find = (re: RegExp) => hs.find(h => re.test(plain(h)));
    const cPlate = hs.find(h => plain(h) === 'bien so')!, cNext = find(/dinh k[iy] tiep theo/)!, cLeft = find(/km bd con lai|^con lai/), cNotice = find(/^thong bao/);

    const byPlate = new Map(lk.vehicles.map(v => [normPlate(v.plate), v]));
    const ch: Change[] = []; const miss: string[] = []; const seen = new Set<string>();
    for (const r of res.rows) {
      const key = normPlate(r[cPlate]);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const next = parseKm(r[cNext]);
      if (next == null || next <= 0) continue;   // chưa có mốc (vd. xe thanh lý)
      const v = byPlate.get(key);
      if (!v) { miss.push(String(r[cPlate])); continue; }
      ch.push({ id: v.id, plate: v.plate, odo: v.odo, oldNext: v.service_next_km ?? null, next, sheetLeft: cLeft ? parseKm(r[cLeft]) : null, notice: cNotice ? String(r[cNotice] ?? '').trim() || null : null });
    }
    setChanges(ch); setUnmatched(miss);
    setInfo(`Sheet "${res.sheet}": ${res.rows.length} dòng. Khớp với app: ${ch.length} xe · không có trong app: ${miss.length} biển số (bỏ qua).`);
  }

  // Đồng bộ tự động từ Google Sheet (cùng việc mà Vercel Cron làm mỗi sáng 06:00)
  async function syncNow() {
    setSyncing(true); setError(''); setMsg('');
    try {
      const r = await syncBtbd();
      setMsg(`✓ Đồng bộ xong: ${r.matched} xe khớp, ${r.changed} xe đổi mốc, ${r.unmatched} biển số trong sheet chưa có trong app.`); lk.reload();
    } catch (e) { setError((e as Error).message); }
    setSyncing(false);
  }

  async function commit() {
    setBusy(true); setError(''); setMsg('');
    const now = new Date().toISOString(); const errs: string[] = [];
    for (let i = 0; i < changes.length; i += 15) {
      const rs = await Promise.all(changes.slice(i, i + 15).map(c => supabase.from('vehicles')
        .update({ service_next_km: c.next, service_sheet_left_km: c.sheetLeft, service_sheet_notice: c.notice, service_synced_at: now }).eq('id', c.id)));
      rs.forEach((r, j) => r.error && errs.push(`${changes[i + j].plate}: ${r.error.message}`));
    }
    setBusy(false);
    if (errs.length) { setError(`Có ${errs.length} xe lỗi: ${errs.slice(0, 3).join('; ')}. Nếu báo thiếu cột, hãy chạy SQL migration 020.`); return; }
    setMsg(`✓ Đã cập nhật mốc BTBD cho ${changes.length} xe.`); setChanges([]); setFile(''); setInfo(''); lk.reload();
  }

  return (
    <div className="card stack">
      <h3>Cập nhật mốc bảo dưỡng định kỳ (BTBD) từ Excel</h3>
      <p className="muted" style={{ margin: 0 }}>App lấy cột <b>Km BD định kì tiếp theo</b> của sheet <b>Data BTBD</b> và cảnh báo xe sắp tới hạn theo ODO hiện tại của xe. <b>Tự động:</b> máy chủ đọc Google Sheet mỗi sáng 06:00 (cần cấu hình <code>BTBD_SHEET_URL</code> trên Vercel). <b>Thủ công:</b> bấm Đồng bộ ngay hoặc chọn file Excel.</p>
      <p className="muted" style={{ margin: 0 }}>Lần cập nhật gần nhất: <b>{lastSync ? new Date(lastSync).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'chưa có'}</b></p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn" disabled={syncing} onClick={syncNow}>{syncing ? 'Đang đồng bộ…' : '🔄 Đồng bộ ngay từ Google Sheet'}</button>
        <label className="btn ghost" style={{ cursor: 'pointer' }}>⬆️ Hoặc chọn file Excel
          <input type="file" accept=".xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </label>
        {file && <span className="muted">{file}</span>}
      </div>
      {msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
      {error && <p className="error">{error}</p>}
      {info && <p>{info}</p>}
      {changes.length > 0 && (
        <>
          <div className="scroll"><table><thead><tr><th>Biển số</th><th className="num">ODO app</th><th className="num">Mốc cũ</th><th className="num">Mốc mới</th><th className="num">Còn lại (theo ODO app)</th><th>Phân loại</th><th>Theo sheet</th></tr></thead><tbody>
            {changes.slice(0, 60).map(c => { const left = serviceLeft({ odo: c.odo, service_next_km: c.next }); return (
              <tr key={c.id}><td>{c.plate}</td><td className="num">{c.odo.toLocaleString('vi-VN')}</td><td className="num">{c.oldNext?.toLocaleString('vi-VN') ?? '—'}</td>
                <td className="num"><b>{c.next.toLocaleString('vi-VN')}</b></td><td className="num">{left?.toLocaleString('vi-VN')}</td><td>{SERVICE_LABEL[serviceState(left)]}</td><td>{c.notice ?? '—'}</td></tr>); })}
          </tbody></table></div>
          {changes.length > 60 && <p className="muted">… và {changes.length - 60} xe khác</p>}
          {unmatched.length > 0 && <p className="muted">Biển số trong sheet chưa có trong app (ví dụ): {unmatched.slice(0, 8).join(', ')}{unmatched.length > 8 ? '…' : ''}</p>}
          <button className="btn" disabled={busy} onClick={commit}>{busy ? 'Đang cập nhật…' : `Cập nhật mốc BTBD cho ${changes.length} xe`}</button>
        </>
      )}
    </div>
  );
}
