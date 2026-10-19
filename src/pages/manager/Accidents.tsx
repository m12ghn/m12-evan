import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadPhotos } from '../../lib/storage';
import { useAuth } from '../../lib/auth';
import type { Lookups } from '../../lib/useLookups';
import SignedPhotos from '../../components/SignedPhotos';
import PhotoList from '../../components/PhotoList';
import { useVehicleFilter } from '../../components/VehicleFilter';

interface Row {
  id: string; created_at: string; driver_id: string; vehicle_id: string | null; trip_id: string | null;
  location: string; description: string; photos: string[]; status: 'new' | 'handling' | 'done'; manager_note: string | null;
}
interface Upd {
  id: string; accident_id: string; created_at: string; author_id: string | null; kind: 'update' | 'insurance';
  note: string | null; photos: string[]; status_to: Row['status'] | null;
}
const STATUS = { new: '🆕 Mới', handling: '🛠️ Đang xử lý', done: '✓ Đã xử lý' } as const;
const fmt = (s: string) => new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const photoMap = (ps: string[]) => Object.fromEntries(ps.map((p, i) => [`p${i}`, p]));
const photoLabels = (ps: string[]) => Object.fromEntries(ps.map((_, i) => [`p${i}`, `Ảnh ${i + 1}`]));

function Entry({ u, lk }: { u: Upd; lk: Lookups }) {
  return (
    <div style={{ borderLeft: '3px solid var(--teal)', paddingLeft: 10 }}>
      <small className="muted"><b>{fmt(u.created_at)}</b> · {lk.person(u.author_id)}{u.status_to && <> · chuyển sang <b>{STATUS[u.status_to]}</b></>}</small>
      {u.note && <p style={{ margin: '2px 0', whiteSpace: 'pre-wrap' }}>{u.note}</p>}
      {u.photos.length > 0 && <SignedPhotos photos={photoMap(u.photos)} labels={photoLabels(u.photos)} />}
    </div>
  );
}

function AccidentCard({ r, ups, lk, onSaved, onRepair }: { r: Row; ups: Upd[]; lk: Lookups; onSaved: () => void; onRepair: () => void }) {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const v = lk.vehicle(r.vehicle_id ?? '');
  const [mode, setMode] = useState<'update' | 'insurance'>('update');
  const [insOpen, setInsOpen] = useState(false);
  const [status, setStatus] = useState<Row['status']>(r.status);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setStatus(r.status); }, [r.status]);

  const progress = ups.filter(u => u.kind === 'update');
  const insurance = ups.filter(u => u.kind === 'insurance');
  const canSave = mode === 'insurance' ? note.trim() !== '' || photos.length > 0 : note.trim() !== '' || photos.length > 0 || status !== r.status;

  async function save() {
    setBusy(true); setError('');
    try {
      const up = await uploadPhotos(uid, 'accident', photos.map((b, i) => [i, b] as [number, Blob]));
      const paths = photos.map((_, i) => up[i]);
      const { error: e } = await supabase.rpc('add_accident_update', {
        p_accident: r.id, p_kind: mode, p_note: note.trim() || null, p_photos: paths, p_status: mode === 'update' ? status : null,
      });
      if (e) throw e;
      setNote(''); setPhotos([]); setInsOpen(false); setMode('update'); onSaved();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  const form = (
    <div className="stack" style={{ background: 'var(--bg)', padding: 12, borderRadius: 12 }}>
      <b>{mode === 'insurance' ? '🛡️ Cập nhật bảo hiểm' : '✏️ Cập nhật diễn biến'}</b>
      {mode === 'update' && (
        <select value={status} onChange={e => setStatus(e.target.value as Row['status'])}>
          {(Object.keys(STATUS) as Row['status'][]).map(k => <option key={k} value={k}>Trạng thái: {STATUS[k]}</option>)}
        </select>
      )}
      <textarea rows={3} placeholder={mode === 'insurance' ? 'Thông tin bảo hiểm: hãng, số hồ sơ, tiến độ, số tiền bồi thường…' : 'Nội dung cập nhật (vd. móp cửa hông, đã đưa xe vào garage…)'}
        value={note} onChange={e => setNote(e.target.value)} />
      <PhotoList photos={photos} onChange={setPhotos} addLabel={mode === 'insurance' ? 'Thêm ảnh hồ sơ bảo hiểm' : 'Thêm ảnh'} />
      {error && <p className="error">{error}</p>}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn" disabled={!canSave || busy} onClick={save}>{busy ? 'Đang lưu…' : mode === 'insurance' ? 'Lưu bảo hiểm' : 'Lưu cập nhật'}</button>
        {mode === 'insurance' && <button className="btn ghost" disabled={busy} onClick={() => { setInsOpen(false); setMode('update'); setNote(''); setPhotos([]); }}>Hủy</button>}
      </div>
    </div>
  );

  return (
    <div className="card stack">
      <div className="row between">
        <b>🚨 {v?.plate ?? 'Chưa chọn xe'} · {lk.person(r.driver_id)}</b>
        <span className="chip">{STATUS[r.status]}</span>
      </div>
      <p className="muted">{new Date(r.created_at).toLocaleString('vi-VN')}</p>
      <p><b>Địa điểm:</b> {r.location}</p>
      <p><b>Mô tả:</b> {r.description}</p>
      <SignedPhotos photos={photoMap(r.photos)} labels={photoLabels(r.photos)} />

      {(progress.length > 0 || r.manager_note) && (
        <div className="stack">
          <h4>Diễn biến xử lý ({progress.length})</h4>
          {r.manager_note && <small className="muted">Ghi chú trước đây: {r.manager_note}</small>}
          {progress.map(u => <Entry key={u.id} u={u} lk={lk} />)}
        </div>
      )}

      <div className="stack">
        <div className="row between"><h4 style={{ margin: 0 }}>🛡️ Bảo hiểm ({insurance.length})</h4>
          {!insOpen && <button className="btn ghost" onClick={() => { setInsOpen(true); setMode('insurance'); setNote(''); setPhotos([]); setError(''); }}>Cập nhật bảo hiểm</button>}</div>
        {insurance.length === 0 && !insOpen && <small className="muted">Chưa có thông tin bảo hiểm</small>}
        {insurance.map(u => <Entry key={u.id} u={u} lk={lk} />)}
      </div>

      {insOpen ? form : (
        <>
          {form}
          {v && v.status !== 'repair' && v.status !== 'on_duty' && (
            <div><button className="btn ghost" onClick={onRepair}>🔧 Chuyển xe sang đang sửa chữa</button></div>
          )}
        </>
      )}
    </div>
  );
}

export default function Accidents({ lk, onChanged }: { lk: Lookups; onChanged: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [updates, setUpdates] = useState<Upd[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const vf = useVehicleFilter(lk, { statuses: (Object.keys(STATUS) as Row['status'][]).map(k => ({ value: k, label: STATUS[k] })), defaultStatuses: ['new'] });

  const load = useCallback(async () => {
    const { data } = await supabase.from('accidents').select('*').order('created_at', { ascending: false }).limit(200);
    const list = (data as Row[]) ?? [];
    setRows(list);
    const ids = list.map(x => x.id);
    const all: Upd[] = [];
    for (let i = 0; i < ids.length; i += 100) {   // chia nhóm để URL không quá dài
      const { data: u } = await supabase.from('accident_updates').select('*').in('accident_id', ids.slice(i, i + 100)).order('created_at');
      all.push(...((u as Upd[]) ?? []));
    }
    setUpdates(all);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function markRepair(r: Row) {
    if (!r.vehicle_id) return;
    setError(''); setMsg('');
    const { data, error: err } = await supabase.from('vehicles').update({ status: 'repair' }).eq('id', r.vehicle_id).select();
    if (err || !data?.length) { setError(err?.message ?? 'Không cập nhật được xe'); return; }
    setMsg(`Đã chuyển xe ${lk.plate(r.vehicle_id)} sang "Đang sửa chữa tai nạn"`); lk.reload();
  }

  const list = rows.filter(r => vf.match(r.vehicle_id, r.driver_id, r.status));
  return (
    <div className="stack">
      {vf.ui}
      <p className="muted" style={{ margin: 0 }}>Hiển thị <b>{list.length}</b> / {rows.length} báo cáo</p>
      {error && <p className="error">{error}</p>}{msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
      {list.map(r => (
        <AccidentCard key={r.id} r={r} lk={lk} ups={updates.filter(u => u.accident_id === r.id)}
          onSaved={() => { setMsg('Đã lưu cập nhật'); load(); onChanged(); }} onRepair={() => markRepair(r)} />
      ))}
      {list.length === 0 && <p className="muted">Không có báo cáo tai nạn nào</p>}
    </div>
  );
}
