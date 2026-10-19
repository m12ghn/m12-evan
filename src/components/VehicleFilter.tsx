import { useMemo, useState } from 'react';
import type { Lookups } from '../lib/useLookups';

// Bộ lọc dùng chung cho các trang quản lý: loại xe (Van Gaz, Van điện…), năng lượng, biển số, tài xế
export function useVehicleFilter(lk: Lookups) {
  const [vtype, setVtype] = useState('');
  const [energy, setEnergy] = useState<'' | 'fuel' | 'electric'>('');
  const [plateId, setPlateId] = useState('');
  const [driver, setDriver] = useState('');
  const active = Boolean(vtype || energy || plateId || driver);

  /** vehicleId có thể rỗng (vd. báo cáo tai nạn chưa chọn xe) */
  const match = (vehicleId: string | null | undefined, driverId: string | null | undefined) => {
    if (vtype || energy || plateId) {
      const v = vehicleId ? lk.vehicle(vehicleId) : undefined;
      if (!v) return false;
      if (vtype && v.type !== vtype) return false;
      if (energy && v.energy_type !== energy) return false;
      if (plateId && v.id !== plateId) return false;
    }
    return !driver || driverId === driver;
  };
  const reset = () => { setVtype(''); setEnergy(''); setPlateId(''); setDriver(''); };

  const types = useMemo(() => [...new Set(lk.vehicles.map(v => v.type).filter(Boolean))].sort() as string[], [lk.vehicles]);
  const drivers = useMemo(() => lk.people.filter(p => p.role === 'driver'), [lk.people]);

  const ui = (
    <div className="filters" style={{ marginBottom: 12 }}>
      <label>Loại xe<select value={vtype} onChange={e => setVtype(e.target.value)}><option value="">Tất cả</option>{types.map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Năng lượng<select value={energy} onChange={e => setEnergy(e.target.value as typeof energy)}><option value="">Tất cả</option><option value="fuel">Xăng / Dầu</option><option value="electric">Điện</option></select></label>
      <label>Biển số<select value={plateId} onChange={e => setPlateId(e.target.value)}><option value="">Tất cả</option>{lk.vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}</select></label>
      <label>Tài xế<select value={driver} onChange={e => setDriver(e.target.value)}><option value="">Tất cả</option>{drivers.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}{p.active === false ? ' (đã nghỉ)' : ''}</option>)}</select></label>
      {active && <label>&nbsp;<button className="btn ghost" onClick={reset}>✕ Xóa lọc</button></label>}
    </div>
  );
  return { match, ui, active };
}
