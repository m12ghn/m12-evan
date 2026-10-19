import { useEffect, useState } from 'react';
import PhotoInput from './PhotoInput';

function Thumb({ blob, onRemove }: { blob: Blob; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const u = URL.createObjectURL(blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [blob]);
  return (
    <div className="thumb-wrap">
      {url && <img src={url} alt="Ảnh" />}
      <button type="button" className="thumb-del" onClick={onRemove} aria-label="Xóa ảnh">×</button>
    </div>
  );
}

// Danh sách ảnh thêm dần (chụp hoặc chọn từ máy), tối đa max ảnh
export default function PhotoList({ photos, onChange, max = 6, addLabel = 'Thêm ảnh' }: {
  photos: Blob[]; onChange: (p: Blob[]) => void; max?: number; addLabel?: string;
}) {
  return (
    <div>
      {photos.length > 0 && (
        <div className="thumbs" style={{ marginBottom: 8 }}>
          {photos.map((b, i) => <Thumb key={i} blob={b} onRemove={() => onChange(photos.filter((_, j) => j !== i))} />)}
        </div>
      )}
      {photos.length < max
        ? <div className="photo-grid"><PhotoInput label={`${addLabel} (${photos.length}/${max})`} allowGallery value={null} onChange={b => onChange(photos.length < max ? [...photos, b] : photos)} /></div>
        : <small className="muted">Đã đủ {max} ảnh</small>}
    </div>
  );
}
