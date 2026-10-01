import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { downloadXlsx, readXlsxRows } from '../../lib/excel';
import type { Lookups } from '../../lib/useLookups';

const HEADERS = ['Biển số', 'Loại xe', 'Năng lượng (Xăng/Dầu/Điện)', 'Loại nhiên liệu', 'Dung tích bình (L) / Pin (kWh)', 'Định mức /100km', 'ODO (km)', 'Mức NL/pin (%)', 'Trạng thái'];
// Từ khóa nhận diện cột (không phân biệt hoa thường)
const KEYS = { plate: 'biển số', type: 'loại xe', energy: 'năng lượng', fuel: 'loại nhiên liệu', capacity: 'dung tích', rate: 'định mức', odo: 'odo', level: 'mức nl', status: 'trạng thái' } as const;
const STATUS: Record<string, 'ready' | 'on_duty' | 'maintenance'> = { 'sẵn sàng': 'ready', 'đang vận hành': 'on_duty', 'bảo dưỡng': 'maintenance' };

interface Parsed { plate: string; type: string; energy_type: 'fuel' | 'electric'; fuel_type: string; capacity: number; std_rate: number; odo: number; energy_level: number; status: 'ready' | 'on_duty' | 'maintenance' }

export async function downloadVehicleTemplate() {
  await downloadXlsx('mau-them-xe.xlsx', [
    { name: 'Xe', widths: [14, 28, 26, 20, 28, 16, 12, 16, 14], rows: [
      HEADERS,
      ['29H-102.34', 'Tải 1.5 Tấn - Kia K250', 'Dầu', 'Dầu Diesel (DO)', 60, 10.5, 45200, 75, 'Sẵn sàng'],
      ['51K-888.99', 'Xe điện VinFast EC Van', 'Điện', 'Điện', 17, 14, 3200, 90, 'Sẵn sàng'],
    ] },
    { name: 'Hướng dẫn', widths: [90], rows: [
      ['HƯỚNG DẪN ĐIỀN (giữ nguyên dòng tiêu đề ở sheet "Xe", xóa 2 dòng mẫu rồi điền xe của bạn)'],
      ['• Biển số: bắt buộc, không trùng nhau trong file.'],
      ['• Năng lượng: "Xăng", "Dầu" hoặc "Điện" (để trống = Dầu).'],
      ['• Loại nhiên liệu: ví dụ "Dầu Diesel (DO)", "Xăng RON 95". Xe điện tự gán "Điện".'],
      ['• Dung tích bình (lít) hoặc dung lượng pin (kWh): bắt buộc, là số > 0.'],
      ['• Định mức: lít/100km hoặc kWh/100km, bắt buộc, là số > 0.'],
      ['• ODO (km): để trống = 0. Mức NL/pin: 0–100, để trống = 50.'],
      ['• Trạng thái: "Sẵn sàng", "Đang vận hành" hoặc "Bảo dưỡng" (để trống = Sẵn sàng).'],
      ['• Biển số ĐÃ có trong hệ thống: chỉ cập nhật loại xe, năng lượng, dung tích, định mức (giữ nguyên ODO/mức NL/trạng thái hiện tại).'],
    ] },
  ]);
}

export default function BulkVehicles({ lk }: { lk: Lookups }) {
  const [valid, setValid] = useState<Parsed[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [file, setFile] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function onFile(f: File) {
    setMsg(''); setValid([]); setErrors([]); setFile(f.name);
    let rows: Record<string, unknown>[];
    try { rows = await readXlsxRows(f); } catch { setErrors(['Không đọc được file. Hãy dùng file .xlsx theo mẫu.']); return; }
    if (!rows.length) { setErrors(['File không có dòng dữ liệu nào.']); return; }

    const headers = Object.keys(rows[0]);
    const col = (k: keyof typeof KEYS) => headers.find(h => h.toLowerCase().includes(KEYS[k]));
    const missing = (Object.keys(KEYS) as (keyof typeof KEYS)[]).filter(k => !col(k) && ['plate', 'capacity', 'rate'].includes(k));
    if (missing.length) { setErrors([`Thiếu cột bắt buộc: ${missing.map(k => KEYS[k]).join(', ')}. Hãy dùng đúng file mẫu.`]); return; }
    const get = (r: Record<string, unknown>, k: keyof typeof KEYS) => { const c = col(k); return c ? String(r[c] ?? '').trim() : ''; };

    const ok: Parsed[] = []; const errs: string[] = []; const seen = new Set<string>();
    rows.forEach((r, i) => {
      const line = i + 2;
      const plate = get(r, 'plate').toUpperCase();
      if (!plate) { if (Object.values(r).some(v => String(v).trim())) errs.push(`Dòng ${line}: thiếu biển số`); return; }
      if (seen.has(plate)) { errs.push(`Dòng ${line}: biển số ${plate} bị trùng trong file`); return; }
      seen.add(plate);
      const e = get(r, 'energy').toLowerCase();
      let energy_type: Parsed['energy_type'] = 'fuel';
      if (/điện|dien|electric/.test(e)) energy_type = 'electric';
      else if (e && !/xăng|xang|dầu|dau|fuel|diesel/.test(e)) { errs.push(`Dòng ${line}: năng lượng "${get(r, 'energy')}" không hợp lệ`); return; }
      const capacity = Number(get(r, 'capacity')), std_rate = Number(get(r, 'rate'));
      if (!(capacity > 0)) { errs.push(`Dòng ${line} (${plate}): dung tích/pin phải là số > 0`); return; }
      if (!(std_rate > 0)) { errs.push(`Dòng ${line} (${plate}): định mức phải là số > 0`); return; }
      const odo = get(r, 'odo') === '' ? 0 : Number(get(r, 'odo'));
      const level = get(r, 'level') === '' ? 50 : Number(get(r, 'level'));
      if (!(odo >= 0) || !(level >= 0 && level <= 100)) { errs.push(`Dòng ${line} (${plate}): ODO phải ≥ 0 và mức NL/pin từ 0–100`); return; }
      const st = get(r, 'status').toLowerCase();
      if (st && !STATUS[st]) { errs.push(`Dòng ${line} (${plate}): trạng thái "${get(r, 'status')}" không hợp lệ`); return; }
      ok.push({
        plate, type: get(r, 'type'), energy_type, capacity, std_rate, odo: Math.round(odo), energy_level: Math.round(level),
        fuel_type: energy_type === 'electric' ? 'Điện' : get(r, 'fuel') || 'Dầu Diesel (DO)', status: STATUS[st] ?? 'ready',
      });
    });
    setValid(ok); setErrors(errs);
  }

  const existing = new Set(lk.vehicles.map(v => v.plate.toUpperCase()));
  const newOnes = valid.filter(v => !existing.has(v.plate));
  const updates = valid.filter(v => existing.has(v.plate));

  async function commit() {
    setBusy(true); setMsg('');
    const errs: string[] = [];
    if (newOnes.length) {
      const { error } = await supabase.from('vehicles').insert(newOnes);
      if (error) errs.push(`Thêm mới lỗi: ${error.message}`);
    }
    const results = await Promise.all(updates.map(v => supabase.from('vehicles')
      .update({ type: v.type, energy_type: v.energy_type, capacity: v.capacity, std_rate: v.std_rate, fuel_type: v.fuel_type })
      .eq('plate', v.plate)));
    results.forEach((r, i) => r.error && errs.push(`Cập nhật ${updates[i].plate} lỗi: ${r.error.message}`));
    setBusy(false);
    if (errs.length) { setErrors(errs); return; }
    setMsg(`✓ Đã thêm ${newOnes.length} xe mới, cập nhật ${updates.length} xe.`);
    setValid([]); setFile(''); lk.reload();
  }

  return (
    <div className="card stack">
      <h3>Thêm xe hàng loạt (Excel)</h3>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn ghost" onClick={downloadVehicleTemplate}>⬇️ Tải file mẫu</button>
        <label className="btn" style={{ cursor: 'pointer' }}>⬆️ Chọn file đã điền
          <input type="file" accept=".xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </label>
        {file && <span className="muted">{file}</span>}
      </div>
      {msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
      {errors.length > 0 && <div className="error"><b>{errors.length} lỗi:</b><ul>{errors.slice(0, 20).map(e => <li key={e}>{e}</li>)}</ul>{errors.length > 20 && <p>… và {errors.length - 20} lỗi khác</p>}</div>}
      {valid.length > 0 && (
        <>
          <p>Hợp lệ <b>{valid.length}</b> dòng: <b>{newOnes.length}</b> xe mới, <b>{updates.length}</b> xe đã có (chỉ cập nhật thông tin xe).</p>
          <div className="scroll"><table><thead><tr><th>Biển số</th><th>Loại xe</th><th>Năng lượng</th><th>Dung tích/Pin</th><th>Định mức</th><th></th></tr></thead><tbody>
            {valid.slice(0, 50).map(v => <tr key={v.plate}><td>{v.plate}</td><td>{v.type}</td><td>{v.energy_type === 'electric' ? '⚡ Điện' : '⛽ ' + v.fuel_type}</td><td>{v.capacity}</td><td>{v.std_rate}</td><td>{existing.has(v.plate) ? 'Cập nhật' : 'Mới'}</td></tr>)}
          </tbody></table></div>
          <button className="btn" disabled={busy} onClick={commit}>{busy ? 'Đang nhập…' : `Nhập ${valid.length} xe vào hệ thống`}</button>
        </>
      )}
    </div>
  );
}
