import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadPhoto } from '../../lib/storage';
import { useDraft } from '../../lib/draft';
import PhotoInput from '../../components/PhotoInput';
import type { Trip, Vehicle } from '../../lib/types';

const MAX_PHOTOS = 6;
const STATUS = { new: '🆕 Đã gửi', handling: '🛠️ Đang xử lý', done: '✓ Đã xử lý' } as const;
interface Mine { id: string; created_at: string; location: string; status: keyof typeof STATUS }

function Thumb({ blob, onRemove }: { blob: Blob; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const u = URL.createObjectURL(blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [blob]);
  return (
    <div className="thumb-wrap">
      {url && <img src={url} alt="Ảnh tai nạn" />}
      <button type="button" className="thumb-del" onClick={onRemove} aria-label="Xóa ảnh">×</button>
    </div>
  );
}

// Báo cáo tai nạn: không cần có ca đang chạy, không cần chụp ảnh vào ca
export default function Accident({ userId, trip, vehicle, onBack }: { userId: string; trip: Trip | null; vehicle: Vehicle | null; onBack: () => void }) {
  const [vehicles, setVehicles] = useState<Pick<Vehicle, 'id' | 'plate' | 'type'>[]>([]);
  const [vehicleId, setVehicleId] = useState(vehicle?.id ?? '');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const draft = useDraft(`accident:${userId}`, { vehicleId, location, description, photos }, d => {
    if (d.vehicleId !== undefined) setVehicleId(d.vehicleId);
    if (d.location !== undefined) setLocation(d.location);
    if (d.description !== undefined) setDescription(d.description);
    if (d.photos) setPhotos(d.photos);
  });

  const loadMine = () => supabase.from('accidents').select('id, created_at, location, status')
    .eq('driver_id', userId).order('created_at', { ascending: false }).limit(5).then(({ data }) => setMine((data as Mine[]) ?? []));
  useEffect(() => {
    supabase.from('vehicles').select('id, plate, type').order('plate').then(({ data }) => setVehicles((data as typeof vehicles) ?? []));
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valid = location.trim() !== '' && description.trim() !== '';

  async function submit() {
    setBusy(true); setError(''); setSent(false);
    try {
      const paths: string[] = [];
      for (const b of photos) paths.push(await uploadPhoto(userId, 'accident', b));
      const { error: e } = await supabase.from('accidents').insert({
        driver_id: userId, vehicle_id: vehicleId || null, trip_id: trip?.id ?? null,
        location: location.trim(), description: description.trim(), photos: paths,
      });
      if (e) throw e;
      setLocation(''); setDescription(''); setPhotos([]); setSent(true);
      await draft.clear(); await loadMine();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="card stack">
      <button className="btn ghost" onClick={onBack}>← Quay lại</button>
      <h3>🚨 Báo cáo tai nạn</h3>
      <p className="muted">Không cần chụp hình vào ca. Điền thông tin và gửi ngay để quản lý xử lý.</p>

      <label>Xe liên quan
        <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
          <option value="">-- Không chọn --</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}{v.type ? ` • ${v.type}` : ''}</option>)}
        </select></label>
      <label>Vị trí / Địa điểm xảy ra tai nạn
        <input placeholder="Địa chỉ hoặc khu vực, ví dụ: QL1A, Km 12, Bình Dương" value={location} onChange={e => setLocation(e.target.value)} /></label>
      <label>Mô tả tai nạn
        <textarea rows={4} placeholder="Mô tả ngắn: chuyện gì xảy ra, thiệt hại, có ai bị thương không…" value={description} onChange={e => setDescription(e.target.value)} /></label>

      <div>
        <b>Hình ảnh tai nạn ({photos.length}/{MAX_PHOTOS})</b>
        <p className="muted">Có thể chụp trực tiếp hoặc chọn ảnh có sẵn trong máy.</p>
        <div className="thumbs" style={{ marginTop: 8 }}>
          {photos.map((b, i) => <Thumb key={i} blob={b} onRemove={() => setPhotos(photos.filter((_, j) => j !== i))} />)}
        </div>
        {photos.length < MAX_PHOTOS && (
          <div className="photo-grid" style={{ marginTop: 8 }}>
            <PhotoInput label={photos.length ? 'Thêm ảnh' : 'Thêm ảnh tai nạn'} allowGallery value={null} onChange={b => setPhotos(p => (p.length < MAX_PHOTOS ? [...p, b] : p))} />
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {sent && <p style={{ color: 'var(--success)' }}>✓ Đã gửi báo cáo tai nạn cho quản lý.</p>}
      <button className="btn" disabled={!valid || busy} onClick={submit}>{busy ? 'Đang gửi…' : 'Gửi báo cáo tai nạn'}</button>

      {mine.length > 0 && (
        <>
          <h3>Báo cáo gần đây</h3>
          {mine.map(r => (
            <div key={r.id} className="row between">
              <span>{new Date(r.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })} · {r.location}</span>
              <span className="chip">{STATUS[r.status]}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
