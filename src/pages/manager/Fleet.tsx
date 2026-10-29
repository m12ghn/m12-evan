import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Lookups } from '../../lib/useLookups';
import { VEHICLE_STATUS, type Vehicle, type VehicleStatus } from '../../lib/types';
import { useVehicleFilter } from '../../components/VehicleFilter';
import { Empty, Highlights } from '../../components/ui';
import CloseTripDialog, { type OpenTrip } from './CloseTripDialog';

const STATUS = VEHICLE_STATUS;

export default function Fleet({ lk, pending, accNew }: { lk: Lookups; pending: number; accNew: number }) {
  const vf = useVehicleFilter(lk, { statuses: (Object.keys(STATUS) as VehicleStatus[]).map(k => ({ value: k, label: STATUS[k] })) });
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

  // Điểm sáng / cần lưu ý: sinh từ trạng thái hiện tại của đội xe
  const stale = openTrips.filter(t => hoursOpen(t) >= 12);
  const good: string[] = [];
  const warn: string[] = [];
  const nReady = lk.vehicles.filter(v => v.status === 'ready').length;
  if (nReady > 0) good.push(`${nReady} xe sẵn sàng nhận ca.`);
  if (lk.vehicles.length > 0 && stale.length === 0) good.push('Không có ca nào quá 12 giờ chưa trả xe.');
  if (pending === 0) good.push('Không có phiếu nhiên liệu/điện chờ duyệt.');
  if (accNew === 0) good.push('Không có báo cáo tai nạn mới.');
  if (stale.length) warn.push(`${stale.length} ca quá 12 giờ chưa trả xe: ${stale.slice(0, 5).map(t => lk.plate(t.vehicle_id)).join(', ')}${stale.length > 5 ? '…' : ''}.`);
  if (pending > 0) warn.push(`${pending} phiếu nhiên liệu/điện đang chờ duyệt.`);
  if (accNew > 0) warn.push(`${accNew} báo cáo tai nạn mới chưa xử lý.`);
  const nRepair = lk.vehicles.filter(v => v.status === 'repair' || v.status === 'maintenance').length;
  if (nRepair > 0) warn.push(`${nRepair} xe đang bảo dưỡng / sửa chữa tai nạn.`);
  const count = (s: VehicleStatus) => lk.vehicles.filter(v => v.status === s).length;
  const list = lk.vehicles.filter(v => vf.match(v.id, v.driver_id, v.status));

  return (
    <>
      <Highlights good={good} warn={warn} />
      <div className="kpis">
        <div className="card"><b>{lk.vehicles.length}</b><span>Tổng xe</span></div>
        <div className="card"><b>{count('on_duty')}</b><span>Đang vận hành</span></div>
        <div className="card"><b>{count('ready')}</b><span>Sẵn sàng</span></div>
        <div className={`card${count('maintenance') + count('repair') > 0 ? ' warn' : ''}`}><b>{count('maintenance') + count('repair')}</b><span>Bảo dưỡng / sửa chữa</span></div>
        <div className="card"><b>{count('inactive')}</b><span>Ngưng hoạt động</span></div>
      </div>
      {vf.ui}
      <p className="muted" style={{ marginTop: 0 }}>Hiển thị <b>{list.length}</b> / {lk.vehicles.length} xe</p>
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
        {list.length === 0 && <Empty>{lk.vehicles.length === 0 ? 'Chưa có xe nào. Vào Cài đặt để thêm xe (từng xe hoặc hàng loạt bằng Excel).' : 'Không có xe nào khớp bộ lọc. Hãy đổi hoặc bấm ↺ Đặt lại bộ lọc.'}</Empty>}
      </div>
      {closing && (
        <CloseTripDialog trip={closing.trip} vehicle={closing.vehicle} driverName={lk.person(closing.trip.driver_id)}
          onClose={() => setClosing(null)}
          onDone={() => { setMsg(`Đã kết thúc ca của xe ${closing.vehicle.plate}.`); setClosing(null); lk.reload(); loadTrips(); }} />
      )}
    </>
  );
}
