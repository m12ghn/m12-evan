import { useState } from 'react';
import type { Lookups } from '../../lib/useLookups';
import { VEHICLE_STATUS, type VehicleStatus } from '../../lib/types';

const STATUS = VEHICLE_STATUS;

export default function Fleet({ lk }: { lk: Lookups }) {
  const [filter, setFilter] = useState<'all' | VehicleStatus>('all');
  const [q, setQ] = useState('');
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
      <div className="grid">
        {list.map(v => (
          <div className="card" key={v.id}>
            <div className="row between"><b>{v.energy_type === 'electric' ? '⚡' : '🚚'} {v.plate}</b><span className={`chip ${v.status}`}>{STATUS[v.status]}</span></div>
            <p className="muted">{v.type}</p>
            <p>ODO: <b>{v.odo.toLocaleString()} km</b> · Định mức {v.std_rate} {v.energy_type === 'electric' ? 'kWh' : 'L'}/100km</p>
            <div className="bar"><div className={v.energy_level < 25 ? 'low' : v.energy_level < 50 ? 'mid' : ''} style={{ width: `${v.energy_level}%` }} /></div>
            <small className="muted">{v.energy_type === 'electric' ? 'Pin' : 'Nhiên liệu'} {v.energy_level}% (~{Math.round(v.energy_level / 100 * v.capacity)} {v.energy_type === 'electric' ? 'kWh' : 'L'}) · Tài xế: {lk.person(v.driver_id)}</small>
          </div>
        ))}
        {list.length === 0 && <p className="muted">Không có xe phù hợp</p>}
      </div>
    </>
  );
}
