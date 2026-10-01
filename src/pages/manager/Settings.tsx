import { Fragment, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import type { Lookups } from '../../lib/useLookups';
import type { Vehicle } from '../../lib/types';
import { adminUsers, usernameOf } from '../../lib/adminApi';
import BulkVehicles from './BulkVehicles';

const empty = { plate: '', type: '', energy_type: 'fuel', capacity: 70, std_rate: 11, fuel_type: 'Dầu Diesel (DO)', odo: 0, energy_level: 50, status: 'ready' };
type Form = typeof empty & { id?: string };

export default function Settings({ lk }: { lk: Lookups }) {
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
              <option value="ready">Sẵn sàng</option><option value="on_duty">Đang vận hành</option><option value="maintenance">Bảo dưỡng</option>
            </select></label>
        </div>
        {error && <p className="error">{error}</p>}{msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
        <div className="row"><button className="btn">{f.id ? 'Lưu thay đổi' : 'Thêm xe'}</button>
          {f.id && <button type="button" className="btn ghost" onClick={() => setF(empty)}>Hủy sửa</button>}</div>
      </form>

      <BulkVehicles lk={lk} />

      <div className="card scroll">
        <h3>Danh sách xe ({lk.vehicles.length})</h3>
        <table><thead><tr><th>Biển số</th><th>Loại</th><th>Năng lượng</th><th>Định mức</th><th></th></tr></thead><tbody>
          {lk.vehicles.map(v => (
            <tr key={v.id}><td>{v.plate}</td><td>{v.type}</td><td>{v.energy_type === 'electric' ? '⚡ Điện' : '⛽ ' + v.fuel_type}</td>
              <td>{v.std_rate}</td><td><button className="btn ghost" onClick={() => edit(v)}>Sửa</button></td></tr>
          ))}
        </tbody></table>
      </div>

      <UsersSection lk={lk} savePerson={savePerson} />
    </div>
  );
}

type PersonField = 'full_name' | 'phone' | 'license';

function UsersSection({ lk, savePerson }: { lk: Lookups; savePerson: (id: string, f: PersonField, v: string) => void }) {
  const [editId, setEditId] = useState('');
  const [uname, setUname] = useState('');
  const [pw, setPw] = useState('');
  const [adding, setAdding] = useState(false);
  const [nu, setNu] = useState({ username: '', password: '', full_name: '', phone: '', license: '', role: 'driver' as 'driver' | 'manager' });
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
            <label>Quyền<select value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value as 'driver' | 'manager' })}><option value="driver">Tài xế</option><option value="manager">Quản lý</option></select></label>
          </div>
          <button className="btn" disabled={busy || !nu.username || nu.password.length < 6} onClick={create}>{busy ? 'Đang tạo…' : 'Tạo tài khoản'}</button>
        </div>
      )}
      <div className="scroll">
        <table><thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>SĐT</th><th>Bằng lái</th><th>Quyền</th><th></th></tr></thead><tbody>
          {lk.people.map(p => {
            const cur = usernameOf(p.email);
            return (
              <Fragment key={p.id}>
                <tr>
                  <td><b>{cur || '—'}</b></td>
                  {(['full_name', 'phone', 'license'] as const).map(k => (
                    <td key={k}><input defaultValue={p[k] ?? ''} onBlur={e => e.target.value !== (p[k] ?? '') && savePerson(p.id, k, e.target.value)} /></td>
                  ))}
                  <td><span className="chip">{p.role === 'manager' ? 'Quản lý' : 'Tài xế'}</span></td>
                  <td><button className="btn ghost" onClick={() => { setEditId(editId === p.id ? '' : p.id); setUname(cur); setPw(''); setError(''); setMsg(''); }}>Đổi TK / MK</button></td>
                </tr>
                {editId === p.id && (
                  <tr><td colSpan={6}><div className="row" style={{ flexWrap: 'wrap' }}>
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
