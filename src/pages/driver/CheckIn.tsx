import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadPhoto } from '../../lib/storage';
import { energyLabels, type Vehicle } from '../../lib/types';
import PhotoSet, { photosComplete, type Photos } from './PhotoSet';

export default function CheckIn({ userId, onDone, onBack }: { userId: string; onDone: () => void; onBack: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [odo, setOdo] = useState('');
  const [level, setLevel] = useState(50);
  const [notes, setNotes] = useState('');
  const [agree, setAgree] = useState(false);
  const [photos, setPhotos] = useState<Photos>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('vehicles').select('*').eq('status', 'ready').order('plate')
      .then(({ data }) => setVehicles((data as Vehicle[]) ?? []));
  }, []);

  const v = vehicles.find(x => x.id === vehicleId);
  const L = energyLabels(v?.energy_type ?? 'fuel');
  const pick = (id: string) => {
    setVehicleId(id);
    const x = vehicles.find(y => y.id === id);
    if (x) { setOdo(String(x.odo)); setLevel(x.energy_level); }
  };
  const valid = v && Number(odo) > 0 && photosComplete(photos) && agree;

  async function submit() {
    if (!v) return;
    setBusy(true); setError('');
    try {
      const paths: Record<string, string> = {};
      for (const [k, blob] of Object.entries(photos)) paths[k] = await uploadPhoto(userId, 'checkin', blob!);
      const { error: e1 } = await supabase.from('trips').insert({
        vehicle_id: v.id, driver_id: userId, start_odo: Number(odo), start_level: level,
        pre_notes: notes || null, photos_start: paths,
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('vehicles')
        .update({ status: 'on_duty', driver_id: userId, odo: Number(odo), energy_level: level }).eq('id', v.id);
      if (e2) throw e2;
      onDone();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className="card stack">
      <button className="btn ghost" onClick={onBack}>← Quay lại</button>
      <h3>📸 Chụp hình đầu ca</h3>
      <select value={vehicleId} onChange={e => pick(e.target.value)}>
        <option value="">-- Chọn xe nhận bàn giao --</option>
        {vehicles.map(x => <option key={x.id} value={x.id}>{x.plate} • {x.type} ({x.energy_type === 'electric' ? '⚡' : '⛽'} {x.energy_level}%)</option>)}
      </select>
      {v && <>
        <label>ODO đầu ca (km)<input type="number" inputMode="numeric" value={odo} onChange={e => setOdo(e.target.value)} /></label>
        <label>{L.level}: {level}% (~{Math.round(level / 100 * v.capacity)} {L.unit})
          <input type="range" min={0} max={100} value={level} onChange={e => setLevel(Number(e.target.value))} /></label>
        <PhotoSet photos={photos} onChange={setPhotos} />
        <textarea placeholder="Ghi chú vết trầy xước / hư hỏng có sẵn (nếu có)" value={notes} onChange={e => setNotes(e.target.value)} />
        <label className="row"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
          Tôi xác nhận tình trạng xe khi nhận đúng như ảnh</label>
      </>}
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={!valid || busy} onClick={submit}>{busy ? 'Đang gửi…' : 'Bắt đầu ca'}</button>
    </div>
  );
}
