import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadPhotos } from '../../lib/storage';
import { energyLabels, type Trip, type Vehicle } from '../../lib/types';
import { useDraft } from '../../lib/draft';
import { notifyTelegram } from '../../lib/notify';
import { onlyDigits } from '../../lib/numbers';
import PhotoSet, { photosComplete, type Photos } from './PhotoSet';

export default function CheckOut({ userId, trip, vehicle, onDone, onBack }:
  { userId: string; trip: Trip; vehicle: Vehicle; onDone: () => void; onBack: () => void }) {
  const L = energyLabels(vehicle.energy_type);
  const [odo, setOdo] = useState('');
  const [level, setLevel] = useState(Math.max(10, trip.start_level - 20));
  const [photos, setPhotos] = useState<Photos>({});
  const [damaged, setDamaged] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const draft = useDraft(`checkout:${trip.id}`, { odo, level, photos, damaged, note }, d => {
    if (d.odo !== undefined) setOdo(d.odo);
    if (d.level !== undefined) setLevel(d.level);
    if (d.photos) setPhotos(d.photos);
    if (d.damaged !== undefined) setDamaged(d.damaged);
    if (d.note !== undefined) setNote(d.note);
  });

  const endOdo = Number(odo);
  const odoOk = odo !== '' && endOdo >= trip.start_odo;
  const km = odoOk ? endOdo - trip.start_odo : 0;
  const valid = odoOk && photosComplete(photos) && (!damaged || note.trim());

  async function submit() {
    setBusy(true); setError('');
    try {
      const paths = await uploadPhotos(userId, 'checkout', Object.entries(photos) as [string, Blob][], (d, t) => setProgress(`Đang tải ảnh ${d}/${t}…`));
      setProgress('Đang gửi…');
      // Tính tiêu hao & cập nhật xe được thực hiện trọn gói trong DB (end_trip)
      const { error: e } = await supabase.rpc('end_trip', {
        p_trip: trip.id, p_end_odo: endOdo, p_end_level: level,
        p_damage: damaged, p_damage_notes: damaged ? note : null, p_photos: paths,
      });
      // Gửi lại sau khi mất mạng mà lần trước đã thành công → ca đã đóng
      if (e && !/Không tìm thấy ca đang chạy/.test(e.message)) throw e;
      notifyTelegram('checkout', trip.id);
      await draft.clear();
      onDone();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className="card stack">
      <button className="btn ghost" onClick={onBack}>← Quay lại</button>
      <h3>📸 Chụp hình cuối ca — {vehicle.plate}</h3>
      <label>ODO cuối ca (km) — tối thiểu {trip.start_odo.toLocaleString()}
        <input inputMode="numeric" pattern="[0-9]*" value={odo} onChange={e => setOdo(onlyDigits(e.target.value))} /></label>
      {odo !== '' && !odoOk && <p className="error">ODO không được nhỏ hơn ODO đầu ca</p>}
      <label>{L.level} còn lại: {level}% (~{Math.round(level / 100 * vehicle.capacity)} {L.unit})
        <input type="range" min={0} max={100} value={level} onChange={e => setLevel(Number(e.target.value))} /></label>
      {odoOk && <p className="muted">Quãng đường: <b>{km.toLocaleString()} km</b></p>}
      <PhotoSet photos={photos} onChange={setPhotos} />
      <label className="row"><input type="radio" checked={!damaged} onChange={() => setDamaged(false)} /> Xe nguyên vẹn</label>
      <label className="row"><input type="radio" checked={damaged} onChange={() => setDamaged(true)} /> Có sự cố / hư hỏng</label>
      {damaged && <textarea placeholder="Mô tả chi tiết sự cố" value={note} onChange={e => setNote(e.target.value)} />}
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={!valid || busy} onClick={submit}>{busy ? progress || 'Đang gửi…' : 'Nộp biên bản trả xe'}</button>
    </div>
  );
}
