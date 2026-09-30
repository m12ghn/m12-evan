import { useEffect, useState } from 'react';
import Shell from '../components/Shell';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { Vehicle } from '../lib/types';

// TODO: port từ prototype/app.js — wizard nhận xe, đổ nhiên liệu, trả xe (upload ảnh lên Storage bucket "photos").
export default function DriverHome() {
  const { session } = useAuth();
  const [mine, setMine] = useState<Vehicle | null>(null);
  const [ready, setReady] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (!session) return;
    supabase.from('vehicles').select('*').eq('driver_id', session.user.id).maybeSingle()
      .then(({ data }) => setMine(data as Vehicle | null));
    supabase.from('vehicles').select('*').eq('status', 'ready').order('plate')
      .then(({ data }) => setReady((data as Vehicle[]) ?? []));
  }, [session]);

  return (
    <Shell title="Tài xế">
      {mine ? (
        <div className="card">
          <h3>Ca đang chạy: {mine.plate}</h3>
          <p className="muted">{mine.type} · ODO {mine.odo.toLocaleString()} km</p>
          <button className="btn">⛽ Xin cấp nhiên liệu</button> <button className="btn ghost">Trả xe</button>
        </div>
      ) : (
        <div className="card">
          <h3>Nhận xe</h3>
          <p className="muted">Chọn xe đang sẵn sàng tại bãi</p>
          <ul>{ready.map(v => <li key={v.id}>{v.plate} — {v.type}</li>)}</ul>
        </div>
      )}
    </Shell>
  );
}
