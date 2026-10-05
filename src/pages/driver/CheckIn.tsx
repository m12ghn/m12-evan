import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadPhotos } from '../../lib/storage';
import { energyLabels, type Vehicle } from '../../lib/types';
import { useDraft } from '../../lib/draft';
import { onlyDigits } from '../../lib/numbers';
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
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const draft = useDraft(`checkin:${userId}`, { vehicleId, odo, level, notes, agree, photos }, d => {
    if (d.vehicleId !== undefined) setVehicleId(d.vehicleId);
    if (d.odo !== undefined) setOdo(d.odo);
    if (d.level !== undefined) setLevel(d.level);
    if (d.notes !== undefined) setNotes(d.notes);
    if (d.agree !== undefined) setAgree(d.agree);
    if (d.photos) setPhotos(d.photos);
  });

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
      const paths = await uploadPhotos(userId, 'checkin', Object.entries(photos) as [string, Blob][], (d, t) => setProgress(`Đang tải ảnh ${d}/${t}…`));
      setProgress('Đang gửi…');
      const { error: e } = await supabase.rpc('start_trip', {
        p_vehicle: v.id, p_odo: Number(odo), p_level: level, p_notes: notes, p_photos: paths,
      });
      // Gửi lại sau khi mất mạng mà lần trước đã thành công → ca đã mở, chỉ cần làm mới màn hình
      if (e && !/đang có ca chưa trả xe/.test(e.message)) throw e;
      await draft.clear();
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
        <label>ODO đầu ca (km)<input inputMode="numeric" pattern="[0-9]*" value={odo} onChange={e => setOdo(onlyDigits(e.target.value))} /></label>
        <p className={odo !== '' && Number(odo) !== v.odo ? 'error' : 'muted'}>
          ODO chốt ca trước: <b>{v.odo.toLocaleString()} km</b>
          {odo !== '' && Number(odo) < v.odo && ' — thấp hơn ca trước, hãy kiểm tra lại số trên đồng hồ'}
          {odo !== '' && Number(odo) > v.odo && ` — cao hơn ${(Number(odo) - v.odo).toLocaleString()} km so với ca trước`}
        </p>
        <label>{L.level}: {level}% (~{Math.round(level / 100 * v.capacity)} {L.unit})
          <input type="range" min={0} max={100} value={level} onChange={e => setLevel(Number(e.target.value))} /></label>
        <PhotoSet photos={photos} onChange={setPhotos} />
        <textarea placeholder="Ghi chú vết trầy xước / hư hỏng có sẵn (nếu có)" value={notes} onChange={e => setNotes(e.target.value)} />
        <label className="row"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
          Tôi xác nhận tình trạng xe khi nhận đúng như ảnh</label>
      </>}
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={!valid || busy} onClick={submit}>{busy ? progress || 'Đang gửi…' : 'Bắt đầu ca'}</button>
    </div>
  );
}
