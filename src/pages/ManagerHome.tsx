import { useEffect, useState } from 'react';
import Shell from '../components/Shell';
import { supabase } from '../lib/supabase';
import type { Vehicle } from '../lib/types';

// TODO: port từ prototype/app.js — tab Đội xe, Nhật ký ca, Duyệt nhiên liệu, Cài đặt.
export default function ManagerHome() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    supabase.from('vehicles').select('*').order('plate').then(({ data }) => setVehicles((data as Vehicle[]) ?? []));
  }, []);

  const count = (s: Vehicle['status']) => vehicles.filter(v => v.status === s).length;

  return (
    <Shell title="Quản lý">
      <div className="kpis">
        <div className="card"><b>{vehicles.length}</b><span>Tổng xe</span></div>
        <div className="card"><b>{count('on_duty')}</b><span>Đang vận hành</span></div>
        <div className="card"><b>{count('ready')}</b><span>Sẵn sàng</span></div>
        <div className="card"><b>{count('maintenance')}</b><span>Bảo dưỡng</span></div>
      </div>
      <div className="card">
        <h3>Đội xe</h3>
        <table>
          <thead><tr><th>Biển số</th><th>Loại</th><th>ODO</th><th>Nhiên liệu / Pin</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {vehicles.map(v => (
              <tr key={v.id}>
                <td>{v.plate}</td><td>{v.type}</td><td>{v.odo.toLocaleString()} km</td>
                <td>{v.energy_level}%</td><td><span className={`chip ${v.status}`}>{v.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
