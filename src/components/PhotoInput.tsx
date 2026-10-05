import { useEffect, useRef, useState } from 'react';
import { compressImage } from '../lib/image';
import { cameraSupported } from '../lib/camera';
import CameraCapture from './CameraCapture';

interface Props {
  label: string; value: Blob | null; onChange: (b: Blob) => void;
  /** Cho phép chọn ảnh có sẵn trong máy (vd. ảnh chụp màn hình). Mặc định chỉ chụp trực tiếp. */
  allowGallery?: boolean;
}

export default function PhotoInput({ label, value, onChange, allowGallery = false }: Props) {
  const [preview, setPreview] = useState('');
  const [camera, setCamera] = useState(false);
  const [sheet, setSheet] = useState(false);
  const fallback = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) { setPreview(''); return; }
    const u = URL.createObjectURL(value);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [value]);

  // Ưu tiên chụp ngay trong trang; nếu thiết bị/quyền không cho thì dùng app camera của máy
  const openCamera = () => (cameraSupported() ? setCamera(true) : fallback.current?.click());
  const start = () => (allowGallery ? setSheet(true) : openCamera());

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { onChange(await compressImage(f)); } catch { alert('Không xử lý được ảnh, vui lòng chọn hoặc chụp lại.'); }
  };

  return (
    <>
      <button type="button" className={`photo${value ? ' done' : ''}`} onClick={start}>
        {preview ? <img src={preview} alt={label} /> : <span>{allowGallery ? '📷 🖼️' : '📷'}</span>}
        <small>{label}</small>
      </button>
      <input ref={fallback} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={handleFile} />
      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <b>{label}</b>
            <button type="button" className="btn" onClick={() => { setSheet(false); openCamera(); }}>📷 Chụp ảnh</button>
            <button type="button" className="btn ghost" onClick={() => { setSheet(false); gallery.current?.click(); }}>🖼️ Chọn từ máy (ảnh / ảnh chụp màn hình)</button>
            <button type="button" className="btn ghost" onClick={() => setSheet(false)}>Hủy</button>
          </div>
        </div>
      )}
      {camera && (
        <CameraCapture label={label}
          onCapture={b => { onChange(b); setCamera(false); }}
          onClose={() => setCamera(false)}
          onUnavailable={() => { setCamera(false); fallback.current?.click(); }} />
      )}
    </>
  );
}
