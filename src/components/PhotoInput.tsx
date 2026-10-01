import { useEffect, useRef, useState } from 'react';
import { compressImage } from '../lib/image';
import { cameraSupported } from '../lib/camera';
import CameraCapture from './CameraCapture';

interface Props { label: string; value: Blob | null; onChange: (b: Blob) => void }

export default function PhotoInput({ label, value, onChange }: Props) {
  const [preview, setPreview] = useState('');
  const [open, setOpen] = useState(false);
  const fallback = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) { setPreview(''); return; }
    const u = URL.createObjectURL(value);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [value]);

  // Ưu tiên chụp ngay trong trang; nếu thiết bị/quyền không cho thì dùng app camera của máy
  const start = () => (cameraSupported() ? setOpen(true) : fallback.current?.click());

  return (
    <>
      <button type="button" className={`photo${value ? ' done' : ''}`} onClick={start}>
        {preview ? <img src={preview} alt={label} /> : <span>📷</span>}
        <small>{label}</small>
      </button>
      <input ref={fallback} type="file" accept="image/*" capture="environment" hidden
        onChange={async e => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f) return;
          try { onChange(await compressImage(f)); } catch { alert('Không xử lý được ảnh, vui lòng chụp lại.'); }
        }} />
      {open && (
        <CameraCapture label={label}
          onCapture={b => { onChange(b); setOpen(false); }}
          onClose={() => setOpen(false)}
          onUnavailable={() => { setOpen(false); fallback.current?.click(); }} />
      )}
    </>
  );
}
