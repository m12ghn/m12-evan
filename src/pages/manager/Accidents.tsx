import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Lookups } from '../../lib/useLookups';
import SignedPhotos from '../../components/SignedPhotos';

interface Row {
  id: string; created_at: string; driver_id: string; vehicle_id: string | null; trip_id: string | null;
  location: string; description: string; photos: string[]; status: 'new' | 'handling' | 'done'; manager_note: string | null;
}
const STATUS = { new: '🆕 Mới', handling: '🛠️ Đang xử lý', done: '✓ Đã xử lý' } as const;

export default function Accidents({ lk, onChanged }: { lk: Lookups; onChanged: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<'all' | Row['status']>('new');
  const [edit, setEdit] = useState<Record<string, { status: Row['status']; note: string }>>({});
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('accidents').select('*').order('created_at', { ascending: false }).limit(200);
    setRows((data as Row[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(r: Row) {
    setError(''); setMsg('');
    const e = edit[r.id] ?? { status: r.status, note: r.manager_note ?? '' };
    const { data, error: err } = await supabase.from('accidents').update({ status: e.status, manager_note: e.note.trim() || null }).eq('id', r.id).select();
    if (err || !data?.length) { setError(err?.message ?? 'Không cập nhật được'); return; }
    setMsg('Đã lưu'); await load(); onChanged();
  }

  async function markRepair(r: Row) {
    if (!r.vehicle_id) return;
    setError(''); setMsg('');
    const { data, error: err } = await supabase.from('vehicles').update({ status: 'repair' }).eq('id', r.vehicle_id).select();
    if (err || !data?.length) { setError(err?.message ?? 'Không cập nhật được xe'); return; }
    setMsg(`Đã chuyển xe ${lk.plate(r.vehicle_id)} sang "Đang sửa chữa tai nạn"`); lk.reload();
  }

  const list = rows.filter(r => filter === 'all' || r.status === filter);
  return (
    <div className="stack">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {(['new', 'handling', 'done', 'all'] as const).map(f => (
          <button key={f} className={`btn ${filter === f ? '' : 'ghost'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Tất cả' : STATUS[f]} ({f === 'all' ? rows.length : rows.filter(r => r.status === f).length})
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}{msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
      {list.map(r => {
        const v = lk.vehicle(r.vehicle_id ?? '');
        const e = edit[r.id] ?? { status: r.status, note: r.manager_note ?? '' };
        return (
          <div className="card stack" key={r.id}>
            <div className="row between">
              <b>🚨 {v?.plate ?? 'Chưa chọn xe'} · {lk.person(r.driver_id)}</b>
              <span className="chip">{STATUS[r.status]}</span>
            </div>
            <p className="muted">{new Date(r.created_at).toLocaleString('vi-VN')}</p>
            <p><b>Địa điểm:</b> {r.location}</p>
            <p><b>Mô tả:</b> {r.description}</p>
            <SignedPhotos photos={Object.fromEntries(r.photos.map((p, i) => [`p${i}`, p]))}
              labels={Object.fromEntries(r.photos.map((_, i) => [`p${i}`, `Ảnh ${i + 1}`]))} />
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <select value={e.status} onChange={ev => setEdit({ ...edit, [r.id]: { ...e, status: ev.target.value as Row['status'] } })}>
                {(Object.keys(STATUS) as Row['status'][]).map(k => <option key={k} value={k}>{STATUS[k]}</option>)}
              </select>
              <input placeholder="Ghi chú xử lý" value={e.note} onChange={ev => setEdit({ ...edit, [r.id]: { ...e, note: ev.target.value } })} style={{ flex: 1, minWidth: 180 }} />
              <button className="btn" onClick={() => save(r)}>Lưu</button>
              {v && v.status !== 'repair' && v.status !== 'on_duty' && (
                <button className="btn ghost" onClick={() => markRepair(r)}>🔧 Chuyển xe sang đang sửa chữa</button>
              )}
            </div>
          </div>
        );
      })}
      {list.length === 0 && <p className="muted">Không có báo cáo tai nạn nào</p>}
    </div>
  );
}
