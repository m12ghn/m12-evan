import { useCallback, useEffect, useState } from 'react';
import Shell from '../components/Shell';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { energyLabels, type Trip, type Vehicle } from '../lib/types';
import CheckIn from './driver/CheckIn';
import Refuel from './driver/Refuel';
import CheckOut from './driver/CheckOut';

type View = 'home' | 'checkin' | 'refuel' | 'checkout';

export default function DriverHome() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const [view, setView] = useState<View>('home');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data: t } = await supabase.from('trips').select('*').eq('driver_id', userId).eq('status', 'on_duty').maybeSingle();
    setTrip(t as Trip | null);
    if (t) {
      const { data: v } = await supabase.from('vehicles').select('*').eq('id', t.vehicle_id).single();
      setVehicle(v as Vehicle);
    } else setVehicle(null);
    setLoading(false);
  }, [userId]);
  useEffect(() => { reload(); }, [reload]);

  const home = () => { setView('home'); reload(); };
  const active = Boolean(trip && vehicle);

  return (
    <Shell title="Tài xế" mobile>
      {loading ? <p className="muted">Đang tải…</p> :
        view === 'checkin' ? <CheckIn userId={userId} onDone={home} onBack={() => setView('home')} /> :
        view === 'refuel' && trip && vehicle ? <Refuel userId={userId} trip={trip} vehicle={vehicle} onBack={() => setView('home')} /> :
        view === 'checkout' && trip && vehicle ? <CheckOut userId={userId} trip={trip} vehicle={vehicle} onDone={home} onBack={() => setView('home')} /> : (
          <div className="stack">
            {active && vehicle && trip && (
              <div className="card">
                <h3>Ca đang chạy: {vehicle.plate}</h3>
                <p className="muted">{vehicle.type} · ODO đầu ca {trip.start_odo.toLocaleString()} km · {energyLabels(vehicle.energy_type).level} {trip.start_level}%</p>
              </div>
            )}
            <button className="menu" disabled={active} onClick={() => setView('checkin')}>
              <span>📸</span><div><b>Chụp hình đầu ca</b><small>Nhận xe, ODO, 5 ảnh</small></div>
            </button>
            <button className="menu" disabled={!active} onClick={() => setView('refuel')}>
              <span>{vehicle?.energy_type === 'electric' ? '⚡' : '⛽'}</span>
              <div><b>Cấp nhiên liệu / Cấp điện</b><small>Xin cấp trong ca, chờ quản lý duyệt</small></div>
            </button>
            <button className="menu" disabled={!active} onClick={() => setView('checkout')}>
              <span>🏁</span><div><b>Chụp hình cuối ca</b><small>Trả xe, ODO cuối, 5 ảnh, tình trạng xe</small></div>
            </button>
          </div>
        )}
    </Shell>
  );
}
