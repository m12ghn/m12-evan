import { useState } from 'react';
import { downloadXlsx, readXlsxRows } from '../../lib/excel';
import { adminUsers } from '../../lib/adminApi';
import type { Lookups } from '../../lib/useLookups';

const HEADERS = ['Tên đăng nhập (MSNV)', 'Mật khẩu', 'Họ tên', 'SĐT', 'Hạng bằng', 'Quyền (Tài xế/Quản lý)'];
const KEYS = { username: 'tên đăng nhập', password: 'mật khẩu', name: 'họ tên', phone: 'sđt', license: 'hạng bằng', role: 'quyền' } as const;
type Role = 'driver' | 'manager' | 'dev';
interface Parsed { username: string; password: string; full_name: string; phone: string; license: string; role: Role }

export async function downloadUserTemplate() {
  await downloadXlsx('mau-them-nguoi-dung.xlsx', [
    { name: 'Người dùng', widths: [22, 16, 26, 16, 12, 24], rows: [
      HEADERS,
      ['10002', 'MatKhau@123', 'Nguyễn Văn A', '0901234567', 'C', 'Tài xế'],
      ['10003', 'MatKhau@456', 'Trần Văn B', '0907654321', 'FC', 'Tài xế'],
    ] },
    { name: 'Hướng dẫn', widths: [90], rows: [
      ['HƯỚNG DẪN ĐIỀN (giữ nguyên dòng tiêu đề ở sheet "Người dùng", xóa 2 dòng mẫu rồi điền người của bạn)'],
      ['• Tên đăng nhập (MSNV): bắt buộc, chỉ gồm chữ, số, . _ - ; không trùng nhau trong file.'],
      ['• Mật khẩu: bắt buộc, tối thiểu 6 ký tự. Nên dùng mật khẩu tạm rồi bảo tài xế đổi sau.'],
      ['• Họ tên, SĐT, Hạng bằng: không bắt buộc.'],
      ['• Quyền: "Tài xế" hoặc "Quản lý" (để trống = Tài xế).'],
      ['• Tên đăng nhập ĐÃ có trong hệ thống sẽ bị báo lỗi và bỏ qua (không ghi đè). Đổi mật khẩu dùng nút "Đổi TK / MK".'],
      ['• Mỗi lần tối đa 500 dòng.'],
    ] },
  ]);
}

export default function BulkUsers({ lk, isDev }: { lk: Lookups; isDev: boolean }) {
  const [valid, setValid] = useState<Parsed[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [file, setFile] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [msg, setMsg] = useState('');

  const existing = new Set(lk.people.map(p => (p.email ?? '').toLowerCase()));
  const exists = (u: string) => existing.has(u.toLowerCase().includes('@') ? u.toLowerCase() : `${u.toLowerCase()}@fleetops.local`);

  async function onFile(f: File) {
    setMsg(''); setValid([]); setErrors([]); setFile(f.name);
    let rows: Record<string, unknown>[];
    try { rows = await readXlsxRows(f); } catch { setErrors(['Không đọc được file. Hãy dùng file .xlsx theo mẫu.']); return; }
    if (!rows.length) { setErrors(['File không có dòng dữ liệu nào.']); return; }
    if (rows.length > 500) { setErrors(['Tối đa 500 dòng mỗi lần. Hãy chia nhỏ file.']); return; }

    const headers = Object.keys(rows[0]);
    const col = (k: keyof typeof KEYS) => headers.find(h => h.toLowerCase().includes(KEYS[k]));
    const missing = (['username', 'password'] as const).filter(k => !col(k));
    if (missing.length) { setErrors([`Thiếu cột bắt buộc: ${missing.map(k => KEYS[k]).join(', ')}. Hãy dùng đúng file mẫu.`]); return; }
    const get = (r: Record<string, unknown>, k: keyof typeof KEYS) => { const c = col(k); return c ? String(r[c] ?? '').trim() : ''; };

    const ok: Parsed[] = []; const errs: string[] = []; const seen = new Set<string>();
    rows.forEach((r, i) => {
      const line = i + 2;
      const username = get(r, 'username');
      if (!username) { if (Object.values(r).some(v => String(v).trim())) errs.push(`Dòng ${line}: thiếu tên đăng nhập`); return; }
      if (!/^[A-Za-z0-9._-]{2,40}(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})?$/.test(username)) { errs.push(`Dòng ${line}: tên đăng nhập "${username}" không hợp lệ (chữ, số, . _ -)`); return; }
      const key = username.toLowerCase();
      if (seen.has(key)) { errs.push(`Dòng ${line}: ${username} bị trùng trong file`); return; }
      seen.add(key);
      if (exists(username)) { errs.push(`Dòng ${line}: ${username} đã có trong hệ thống (bỏ qua)`); return; }
      const password = get(r, 'password');
      if (password.length < 6) { errs.push(`Dòng ${line} (${username}): mật khẩu tối thiểu 6 ký tự`); return; }
      const rl = get(r, 'role').toLowerCase();
      let role: Role = 'driver';
      if (/quản lý|quan ly|manager|admin/.test(rl)) role = 'manager';
      else if (/^dev/.test(rl)) { if (!isDev) { errs.push(`Dòng ${line} (${username}): chỉ Dev mới tạo được tài khoản Dev`); return; } role = 'dev'; }
      else if (rl && !/tài xế|tai xe|driver/.test(rl)) { errs.push(`Dòng ${line} (${username}): quyền "${get(r, 'role')}" không hợp lệ`); return; }
      ok.push({ username, password, full_name: get(r, 'name'), phone: get(r, 'phone'), license: get(r, 'license'), role });
    });
    setValid(ok); setErrors(errs);
  }

  async function commit() {
    setBusy(true); setMsg(''); setErrors([]);
    const errs: string[] = []; let created = 0;
    const CHUNK = 10; // mỗi lần gọi server tạo 10 tài khoản
    for (let i = 0; i < valid.length; i += CHUNK) {
      const part = valid.slice(i, i + CHUNK);
      setProgress(`Đang tạo ${Math.min(i + CHUNK, valid.length)}/${valid.length}…`);
      try {
        const { results } = await adminUsers({ action: 'bulk_create', users: part }) as { results: { username: string; ok: boolean; error: string | null }[] };
        results.forEach(r => { if (r.ok) created++; else errs.push(`${r.username}: ${r.error}`); });
      } catch (e) { part.forEach(u => errs.push(`${u.username}: ${(e as Error).message}`)); }
    }
    setBusy(false); setProgress('');
    setMsg(`✓ Đã tạo ${created}/${valid.length} tài khoản.`);
    setErrors(errs); setValid([]); setFile(''); lk.reload();
  }

  return (
    <div className="card stack">
      <h3>Thêm người dùng hàng loạt (Excel)</h3>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn ghost" onClick={downloadUserTemplate}>⬇️ Tải file mẫu</button>
        <label className="btn" style={{ cursor: 'pointer' }}>⬆️ Chọn file đã điền
          <input type="file" accept=".xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </label>
        {file && <span className="muted">{file}</span>}
      </div>
      {msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
      {errors.length > 0 && <div className="error"><b>{errors.length} lỗi:</b><ul>{errors.slice(0, 20).map(e => <li key={e}>{e}</li>)}</ul>{errors.length > 20 && <p>… và {errors.length - 20} lỗi khác</p>}</div>}
      {valid.length > 0 && (
        <>
          <p>Sẽ tạo <b>{valid.length}</b> tài khoản mới{errors.length > 0 && ' (các dòng lỗi ở trên sẽ bị bỏ qua)'}.</p>
          <div className="scroll"><table><thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>SĐT</th><th>Bằng lái</th><th>Quyền</th></tr></thead><tbody>
            {valid.slice(0, 50).map(u => <tr key={u.username}><td>{u.username}</td><td>{u.full_name}</td><td>{u.phone}</td><td>{u.license}</td><td>{u.role === 'dev' ? 'Dev' : u.role === 'manager' ? 'Quản lý' : 'Tài xế'}</td></tr>)}
          </tbody></table></div>
          <button className="btn" disabled={busy} onClick={commit}>{busy ? progress || 'Đang tạo…' : `Tạo ${valid.length} tài khoản`}</button>
        </>
      )}
    </div>
  );
}
