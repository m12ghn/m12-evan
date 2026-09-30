import { useEffect, useState } from 'react';
import { compressImage } from '../lib/image';

interface Props { label: string; value: Blob | null; onChange: (b: Blob) => void }

export default function PhotoInput({ label, value, onChange }: Props) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!value) { setPreview(''); return; }
    const u = URL.createObjectURL(value);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [value]);

  return (
    <label className={`photo${value ? ' done' : ''}`}>
      {preview ? <img src={preview} alt={label} /> : <span>📷</span>}
      <small>{label}</small>
      <input type="file" accept="image/*" capture="environment" hidden
        onChange={async e => { const f = e.target.files?.[0]; if (f) onChange(await compressImage(f)); }} />
    </label>
  );
}
