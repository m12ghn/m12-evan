import { Fragment, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import type { Lookups } from '../../lib/useLookups';
import { VEHICLE_STATUS, type Vehicle, type VehicleStatus } from '../../lib/types';
import { adminUsers, usernameOf } from '../../lib/adminApi';
import BulkVehicles from './BulkVehicles';
import BulkUsers from './BulkUsers';
import { useAuth } from '../../lib/auth';
import TelegramSettings from './TelegramSettings';

const empty = { plate: '', type: '', energy_type: 'fuel', capacity: 70, std_rate: 11, fuel_type: 'Dầu Diesel (DO)', odo: 0, energy_level: 50, status: 'ready' };
type Form = typeof empty & { id?: string };

export default function Settings({ lk, isDev }: { lk: Lookups; isDev: boolean }) {
  const [f, setF] = useState<Form>(empty);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });

  function edit(v: Vehicle) { setF({ ...v } as Form); setMsg(''); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  async function save(e: FormEvent) {
    e.preventDefault(); setError(''); setMsg('');
    const { id, ...body } = f;
    const payload = { ...body, plate: body.plate.trim().toUpperCase() };
    const q = id ? supabase.from('vehicles').update(payload).eq('id', id) : supabase.from('vehicles').insert(payload);
    const { error: err } = await q;
    if (err) { setError(err.message.includes('duplicate') ? 'Biển số đã tồn tại' : err.message); return; }
    setMsg(id ? 'Đã cập nhật xe' : 'Đã thêm xe'); setF(empty); lk.reload();
  }

  async function savePerson(id: string, field: 'full_name' | 'phone' | 'license', value: string) {
    await supabase.from('profiles').update({ [field]: value || null }).eq('id', id);
    lk.reload();
  }

  const electric = f.energy_type === 'electric';
  return (
    <div className="stack">
      <form className="card stack" onSubmit={save}>
        <h3>{f.id ? 'Sửa xe' : 'Thêm xe'}</h3>
        <div className="form-grid">
          <label>Biển số<input required value={f.plate} onChange={e => set('plate', e.target.value)} /></label>
          <label>Loại xe<input value={f.type} onChange={e => set('type', e.target.value)} /></label>
          <label>Năng lượng
            <select value={f.energy_type} onChange={e => setF({ ...f, energy_type: e.target.value, fuel_type: e.target.value === 'electric' ? 'Điện' : 'Dầu Diesel (DO)' })}>
              <option value="fuel">Xăng / Dầu</option><option value="electric">Điện</option>
            </select></label>
          <label>Loại nhiên liệu<input value={f.fuel_type} onChange={e => set('fuel_type', e.target.value)} /></label>
          <label>{electric ? 'Dung lượng pin (kWh)' : 'Dung tích bình (lít)'}<input type="number" step="any" value={f.capacity} onChange={e => set('capacity', Number(e.target.value))} /></label>
          <label>Định mức ({electric ? 'kWh' : 'L'}/100km)<input type="number" step="any" value={f.std_rate} onChange={e => set('std_rate', Number(e.target.value))} /></label>
          <label>ODO (km)<input type="number" value={f.odo} onChange={e => set('odo', Number(e.target.value))} /></label>
          <label>Trạng thái
            <select value={f.status} onChange={e => set('status', e.target.value)}>
              {(Object.entries(VEHICLE_STATUS) as [VehicleStatus, string][]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
        </div>
        {error && <p className="error">{error}</p>}{msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
        <div className="row"><button className="btn">{f.id ? 'Lưu thay đổi' : 'Thêm xe'}</button>
          {f.id && <button type="button" className="btn ghost" onClick={() => setF(empty)}>Hủy sửa</button>}</div>
      </form>

      <BulkVehicles lk={lk} />

      <div className="card scroll">
        <h3>Danh sách xe ({lk.vehicles.length})</h3>
        <table><thead><tr><th>Biển số</th><th>Loại</th><th>Năng lượng</th><th>Định mức</th><th>Trạng thái</th><th></th></tr></thead><tbody>
          {lk.vehicles.map(v => (
            <tr key={v.id}><td>{v.plate}</td><td>{v.type}</td><td>{v.energy_type === 'electric' ? '⚡ Điện' : '⛽ ' + v.fuel_type}</td>
              <td>{v.std_rate}</td><td><span className={`chip ${v.status}`}>{VEHICLE_STATUS[v.status]}</span></td><td><button className="btn ghost" onClick={() => edit(v)}>Sửa</button></td></tr>
          ))}
        </tbody></table>
      </div>

      {isDev && <TelegramSettings />}

      <BulkUsers lk={lk} isDev={isDev} />

      <UsersSection lk={lk} savePerson={savePerson} isDev={isDev} />
    </div>
  );
}

type PersonField = 'full_name' | 'phone' | 'license';

function UsersSection({ lk, savePerson, isDev }: { lk: Lookups; savePerson: (id: string, f: PersonField, v: string) => void; isDev: boolean }) {
  const { session } = useAuth();
  const me = session?.user.id;
  const [editId, setEditId] = useState('');
  const [uname, setUname] = useState('');
  const [pw, setPw] = useState('');
  const [adding, setAdding] = useState(false);
  const [nu, setNu] = useState({ username: '', password: '', full_name: '', phone: '', license: '', role: 'driver' as 'driver' | 'manager' | 'dev' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setError(''); setMsg('');
    try { await fn(); setMsg(ok); lk.reload(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  }
  const saveCreds = async (id: string, current: string) => {
    const username = uname.trim() && uname.trim() !== current ? uname.trim() : undefined;
    if (await run(() => adminUsers({ action: 'update', id, username, password: pw || undefined }), 'Đã cập nhật tài khoản')) { setEditId(''); setPw(''); }
  };
  const toggleActive = async (id: string, currentlyInactive: boolean, name: string) => {
    const msg = currentlyInactive ? `Cho ${name} đi làm lại và đăng nhập được?` : `Cho ${name} nghỉ việc? Tài khoản sẽ bị khóa, không đăng nhập được nữa.`;
    if (!window.confirm(msg)) return;
    await run(() => adminUsers({ action: 'set_active', id, active: currentlyInactive }), currentlyInactive ? 'Đã cho đi làm lại' : 'Đã cho nghỉ việc (tài khoản bị khóa)');
  };
  const create = async () => {
    if (await run(() => adminUsers({ action: 'create', ...nu }), `Đã tạo tài khoản ${nu.username}`)) {
      setAdding(false); setNu({ username: '', password: '', full_name: '', phone: '', license: '', role: 'driver' });
    }
  };

  return (
    <div className="card stack">
      <div className="row between"><h3>Người dùng ({lk.people.length})</h3>
        <button className="btn" onClick={() => setAdding(!adding)}>{adding ? 'Đóng' : '+ Thêm người dùng'}</button></div>
      {error && <p className="error">{error}</p>}{msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
      {adding && (
        <div className="stack" style={{ background: 'var(--bg)', padding: 12, borderRadius: 12 }}>
          <div className="form-grid">
            <label>Tên đăng nhập (MSNV)<input value={nu.username} onChange={e => setNu({ ...nu, username: e.target.value })} /></label>
            <label>Mật khẩu (≥ 6 ký tự)<input type="text" value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })} /></label>
            <label>Họ tên<input value={nu.full_name} onChange={e => setNu({ ...nu, full_name: e.target.value })} /></label>
            <label>SĐT<input value={nu.phone} onChange={e => setNu({ ...nu, phone: e.target.value })} /></label>
            <label>Hạng bằng<input value={nu.license} onChange={e => setNu({ ...nu, license: e.target.value })} /></label>
            <label>Quyền<select value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value as 'driver' | 'manager' | 'dev' })}><option value="driver">Tài xế</option><option value="manager">Quản lý</option>{isDev && <option value="dev">Dev (toàn quyền)</option>}</select></label>
          </div>
          <button className="btn" disabled={busy || !nu.username || nu.password.length < 6} onClick={create}>{busy ? 'Đang tạo…' : 'Tạo tài khoản'}</button>
        </div>
      )}
      <div className="scroll">
        <table><thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>SĐT</th><th>Bằng lái</th><th>Quyền</th><th>Trạng thái</th><th></th></tr></thead><tbody>
          {lk.people.filter(p => isDev || p.role !== 'dev').map(p => {
            const cur = usernameOf(p.email);
            return (
              <Fragment key={p.id}>
                <tr>
                  <td><b>{cur || '—'}</b></td>
                  {(['full_name', 'phone', 'license'] as const).map(k => (
                    <td key={k}><input defaultValue={p[k] ?? ''} onBlur={e => e.target.value !== (p[k] ?? '') && savePerson(p.id, k, e.target.value)} /></td>
                  ))}
                  <td><span className="chip">{p.role === 'dev' ? 'Dev' : p.role === 'manager' ? 'Quản lý' : 'Tài xế'}</span></td>
                  <td><span className={`chip ${p.active === false ? 'inactive' : 'on_duty'}`}>{p.active === false ? 'Đã nghỉ' : 'Còn làm'}</span></td>
                  <td><button className="btn ghost" onClick={() => { setEditId(editId === p.id ? '' : p.id); setUname(cur); setPw(''); setError(''); setMsg(''); }}>Đổi TK / MK</button>{' '}
                    <button className="btn ghost" disabled={busy || p.id === me} onClick={() => toggleActive(p.id, p.active === false, p.full_name ?? cur)}>
                      {p.active === false ? 'Cho đi làm lại' : 'Cho nghỉ việc'}</button></td>
                </tr>
                {editId === p.id && (
                  <tr><td colSpan={7}><div className="row" style={{ flexWrap: 'wrap' }}>
                    <label className="stack">Tên đăng nhập mới<input value={uname} onChange={e => setUname(e.target.value)} /></label>
                    <label className="stack">Mật khẩu mới (bỏ trống = giữ nguyên)<input type="text" value={pw} onChange={e => setPw(e.target.value)} /></label>
                    <button className="btn" disabled={busy} onClick={() => saveCreds(p.id, cur)}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
                  </div></td></tr>
                )}
              </Fragment>
            );
          })}
        </tbody></table>
      </div>
    </div>
  );
}
