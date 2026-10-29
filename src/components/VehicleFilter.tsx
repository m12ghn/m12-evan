import { useMemo, useState } from 'react';
import type { Lookups } from '../lib/useLookups';
import MultiSelect, { type Opt } from './MultiSelect';

// Bộ lọc dùng chung cho các trang quản lý: trạng thái, loại xe (Van Gaz, Van điện…), năng lượng, biển số, tài xế.
// Mỗi ô vừa gõ để tìm vừa chọn được nhiều giá trị; để trống = không lọc.
export function useVehicleFilter(lk: Lookups, opts?: { statuses?: Opt[]; defaultStatuses?: string[]; statusLabel?: string }) {
  const [statuses, setStatuses] = useState<string[]>(opts?.defaultStatuses ?? []);
  const [types, setTypes] = useState<string[]>([]);
  const [energies, setEnergies] = useState<string[]>([]);
  const [plates, setPlates] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<string[]>([]);
  const active = Boolean(statuses.length || types.length || energies.length || plates.length || drivers.length);

  /** vehicleId có thể rỗng (vd. báo cáo tai nạn chưa chọn xe); status chỉ dùng khi trang có bộ lọc trạng thái; skipStatus = bỏ qua bộ lọc trạng thái (vd. khi xuất file) */
  const match = (vehicleId: string | null | undefined, driverId: string | null | undefined, status?: string, skipStatus = false) => {
    if (!skipStatus && statuses.length && !(status && statuses.includes(status))) return false;
    if (types.length || energies.length || plates.length) {
      const v = vehicleId ? lk.vehicle(vehicleId) : undefined;
      if (!v) return false;
      if (types.length && !types.includes(v.type ?? '')) return false;
      if (energies.length && !energies.includes(v.energy_type)) return false;
      if (plates.length && !plates.includes(v.id)) return false;
    }
    return !drivers.length || (driverId != null && drivers.includes(driverId));
  };
  const reset = () => { setStatuses([]); setTypes([]); setEnergies([]); setPlates([]); setDrivers([]); };

  const typeOpts = useMemo<Opt[]>(() => [...new Set(lk.vehicles.map(v => v.type).filter(Boolean))].sort().map(t => ({ value: t as string, label: t as string })), [lk.vehicles]);
  const plateOpts = useMemo<Opt[]>(() => lk.vehicles.map(v => ({ value: v.id, label: v.plate })), [lk.vehicles]);
  const driverOpts = useMemo<Opt[]>(() => lk.people.filter(p => p.role === 'driver')
    .map(p => ({ value: p.id, label: `${p.full_name ?? p.email ?? '—'}${p.active === false ? ' (đã nghỉ)' : ''}` })), [lk.people]);

  const names = (ids: string[], opts: Opt[]) => ids.map(i => opts.find(o => o.value === i)?.label ?? i).join(', ');
  const parts = [
    statuses.length && opts?.statuses ? `${opts.statusLabel ?? 'Trạng thái'}: ${names(statuses, opts.statuses)}` : '',
    types.length ? `Loại xe: ${types.join(', ')}` : '',
    energies.length ? `Năng lượng: ${energies.map(e => (e === 'electric' ? 'Điện' : 'Xăng / Dầu')).join(', ')}` : '',
    plates.length ? `Biển số: ${names(plates, plateOpts)}` : '',
    drivers.length ? `Tài xế: ${names(drivers, driverOpts)}` : '',
  ].filter(Boolean);
  const ui = (
    <div className="filters" style={{ marginBottom: 12 }}>
      {opts?.statuses && <MultiSelect label={opts.statusLabel ?? 'Trạng thái'} options={opts.statuses} value={statuses} onChange={setStatuses} />}
      <MultiSelect label="Loại xe" options={typeOpts} value={types} onChange={setTypes} />
      <MultiSelect label="Năng lượng" options={[{ value: 'fuel', label: 'Xăng / Dầu' }, { value: 'electric', label: 'Điện' }]} value={energies} onChange={setEnergies} />
      <MultiSelect label="Biển số" options={plateOpts} value={plates} onChange={setPlates} />
      <MultiSelect label="Tài xế" options={driverOpts} value={drivers} onChange={setDrivers} />
      {active && <div className="ms"><span className="ms-label">&nbsp;</span><button className="btn ghost" onClick={reset}>↺ Đặt lại bộ lọc</button></div>}
      {parts.length > 0 && <p className="muted" style={{ gridColumn: '1 / -1', margin: 0 }}>Đang xem: {parts.join(' · ')}</p>}
    </div>
  );
  return { match, ui, active, key: [statuses, types, energies, plates, drivers].map(a => a.join(',')).join('|') };
}
