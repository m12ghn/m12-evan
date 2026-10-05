import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Lookups } from '../../lib/useLookups';
import { VEHICLE_STATUS, type Vehicle, type VehicleStatus } from '../../lib/types';
import CloseTripDialog, { type OpenTrip } from './CloseTripDialog';

const STATUS = VEHICLE_STATUS;

export default function Fleet({ lk }: { lk: Lookups }) {
  const [filter, setFilter] = useState<'all' | VehicleStatus>('all');
  const [q, setQ] = useState('');
  const [openTrips, setOpenTrips] = useState<OpenTrip[]>([]);
  const [closing, setClosing] = useState<{ trip: OpenTrip; vehicle: Vehicle } | null>(null);
  const [msg, setMsg] = useState('');

  const loadTrips = useCallback(async () => {
    const { data } = await supabase.from('trips').select('id, vehicle_id, driver_id, start_time, start_odo, start_level').eq('status', 'on_duty');
    setOpenTrips((data as OpenTrip[]) ?? []);
  }, []);
  useEffect(() => { loadTrips(); }, [loadTrips]);
  const tripOf = (vehicleId: string) => openTrips.find(t => t.vehicle_id === vehicleId);
  const hoursOpen = (t: OpenTrip) => Math.floor((Date.now() - Date.parse(t.start_time)) / 3600_000);

  const count = (s: VehicleStatus) => lk.vehicles.filter(v => v.status === s).length;
  const list = lk.vehicles.filter(v => (filter === 'all' || v.status === filter) &&
    (!q || `${v.plate} ${v.type} ${lk.person(v.driver_id)}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <div className="kpis">
        <div className="card"><b>{lk.vehicles.length}</b><span>Tổng xe</span></div>
        <div className="card"><b>{count('on_duty')}</b><span>Đang vận hành</span></div>
        <div className="card"><b>{count('ready')}</b><span>Sẵn sàng</span></div>
        <div className="card"><b>{count('maintenance') + count('repair')}</b><span>Bảo dưỡng / sửa chữa</span></div>
        <div className="card"><b>{count('inactive')}</b><span>Ngưng hoạt động</span></div>
      </div>
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Tìm biển số, loại xe, tài xế…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        {(['all', 'on_duty', 'ready', 'maintenance', 'repair', 'inactive'] as const).map(f => (
          <button key={f} className={`btn ${filter === f ? '' : 'ghost'}`} onClick={() => setFilter(f)}>{f === 'all' ? 'Tất cả' : STATUS[f]}</button>
        ))}
      </div>
      {msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
      <div className="grid">
        {list.map(v => {
          const trip = v.status === 'on_duty' ? tripOf(v.id) : undefined;
          const stale = trip ? hoursOpen(trip) >= 12 : false;
          return (
          <div className="card" key={v.id}>
            <div className="row between"><b>{v.energy_type === 'electric' ? '⚡' : '🚚'} {v.plate}</b><span className={`chip ${v.status}`}>{STATUS[v.status]}</span></div>
            <p className="muted">{v.type}</p>
            <p>ODO: <b>{v.odo.toLocaleString()} km</b> · Định mức {v.std_rate} {v.energy_type === 'electric' ? 'kWh' : 'L'}/100km</p>
            <div className="bar"><div className={v.energy_level < 25 ? 'low' : v.energy_level < 50 ? 'mid' : ''} style={{ width: `${v.energy_level}%` }} /></div>
            <small className="muted">{v.energy_type === 'electric' ? 'Pin' : 'Nhiên liệu'} {v.energy_level}% (~{Math.round(v.energy_level / 100 * v.capacity)} {v.energy_type === 'electric' ? 'kWh' : 'L'}) · Tài xế: {lk.person(v.driver_id)}</small>
            {trip && (
              <div className="stack" style={{ marginTop: 8 }}>
                <small className={stale ? 'error' : 'muted'}>
                  Ca từ {new Date(trip.start_time).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })} · đã {hoursOpen(trip)} giờ{stale ? ' ⏰ chưa trả xe' : ''}
                </small>
                <button className="btn ghost" onClick={() => { setMsg(''); setClosing({ trip, vehicle: v }); }}>⏹ Kết thúc ca</button>
              </div>
            )}
          </div>
          );
        })}
        {list.length === 0 && <p className="muted">Không có xe phù hợp</p>}
      </div>
      {closing && (
        <CloseTripDialog trip={closing.trip} vehicle={closing.vehicle} driverName={lk.person(closing.trip.driver_id)}
          onClose={() => setClosing(null)}
          onDone={() => { setMsg(`Đã kết thúc ca của xe ${closing.vehicle.plate}.`); setClosing(null); lk.reload(); loadTrips(); }} />
      )}
    </>
  );
}
