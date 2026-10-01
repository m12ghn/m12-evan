import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Lookups } from '../../lib/useLookups';
import SignedPhotos from '../../components/SignedPhotos';

interface Row {
  id: string; trip_id: string; driver_id: string; created_at: string; energy_type: 'fuel' | 'electric';
  fuel_type: string | null; odo_at_refuel: number; quantity: number; unit_price: number; total_amount: number;
  station: string | null; photo_pump: string | null; photo_receipt: string | null;
  status: 'pending' | 'approved' | 'rejected'; manager_note: string | null;
}
const money = (n: number) => Math.round(n).toLocaleString('vi-VN') + ' đ';
const STATUS = { pending: '⏳ Chờ duyệt', approved: '✓ Đã duyệt', rejected: '❌ Từ chối' } as const;

export default function Fuel({ lk, onChanged }: { lk: Lookups; onChanged: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [tripVehicle, setTripVehicle] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [r, t] = await Promise.all([
      supabase.from('refuels').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('trips').select('id, vehicle_id').limit(500),
    ]);
    setRows((r.data as Row[]) ?? []);
    setTripVehicle(Object.fromEntries((t.data ?? []).map(x => [x.id, x.vehicle_id])));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(id: string, status: 'approved' | 'rejected') {
    setError('');
    const note = notes[id]?.trim();
    if (status === 'rejected' && !note) { setError('Nhập lý do khi từ chối'); return; }
    const { data, error: e } = await supabase.from('refuels').update({ status, manager_note: note || null }).eq('id', id).select();
    if (e || !data?.length) { setError(e?.message ?? 'Không cập nhật được phiếu'); return; }
    await load(); onChanged();
  }

  const list = rows.filter(r => filter === 'all' || r.status === filter);
  return (
    <div className="stack">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button key={f} className={`btn ${filter === f ? '' : 'ghost'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Tất cả' : STATUS[f]} ({f === 'all' ? rows.length : rows.filter(r => r.status === f).length})
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {list.map(r => {
        const v = lk.vehicle(tripVehicle[r.trip_id]);
        const unit = r.energy_type === 'electric' ? 'kWh' : 'L';
        const over = v != null && r.quantity > v.capacity;
        return (
          <div className="card stack" key={r.id}>
            <div className="row between">
              <b>{r.energy_type === 'electric' ? '⚡' : '⛽'} {v?.plate ?? '—'} · {lk.person(r.driver_id)}</b>
              <span className="chip">{STATUS[r.status]}</span>
            </div>
            <p>
              <b>{r.quantity} {unit}</b> × {r.unit_price.toLocaleString('vi-VN')} đ = <b>{money(r.total_amount)}</b>
              {over && <span className="error"> ⚠️ Vượt dung tích bình/pin ({v!.capacity} {unit})</span>}
            </p>
            <p className="muted">{new Date(r.created_at).toLocaleString('vi-VN')} · ODO {r.odo_at_refuel.toLocaleString()} km · {r.station || 'Chưa ghi trạm'} · {r.fuel_type}</p>
            <SignedPhotos
              photos={{ pump: r.photo_pump ?? '', receipt: r.photo_receipt ?? '' }}
              labels={{ pump: r.energy_type === 'electric' ? 'Màn hình trạm sạc' : 'Cột bơm', receipt: 'Hóa đơn' }} />
            {r.status === 'pending' ? (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <input placeholder="Ghi chú (bắt buộc nếu từ chối)" value={notes[r.id] ?? ''} onChange={e => setNotes({ ...notes, [r.id]: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
                <button className="btn" onClick={() => decide(r.id, 'approved')}>✓ Duyệt</button>
                <button className="btn ghost" onClick={() => decide(r.id, 'rejected')}>Từ chối</button>
              </div>
            ) : r.manager_note && <p className="muted">Ghi chú: {r.manager_note}</p>}
          </div>
        );
      })}
      {list.length === 0 && <p className="muted">Không có phiếu nào</p>}
    </div>
  );
}
