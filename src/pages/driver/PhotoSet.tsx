import PhotoInput from '../../components/PhotoInput';

export const ANGLES = [
  ['taplo', 'Taplo (ODO + mức NL/pin)'], ['front', 'Đầu xe'], ['back', 'Đuôi xe'], ['left', 'Sườn trái'], ['right', 'Sườn phải'],
] as const;
// Giấy tờ xe: chỉ bắt buộc khi bắt đầu ca (có thể chọn ảnh có sẵn trong máy)
export const DOCS = [['insurance', 'Bảo hiểm bắt buộc'], ['mortgage', 'Giấy thế chấp ngân hàng']] as const;
export type Photos = Partial<Record<(typeof ANGLES)[number][0] | (typeof DOCS)[number][0], Blob>>;
export const photosComplete = (p: Photos, docs = false) => ANGLES.every(([k]) => p[k]) && (!docs || DOCS.every(([k]) => p[k]));

export default function PhotoSet({ photos, onChange, docs = false }: { photos: Photos; onChange: (p: Photos) => void; docs?: boolean }) {
  return (
    <div className="photo-grid">
      {ANGLES.map(([k, label]) => (
        <PhotoInput key={k} label={label} value={photos[k] ?? null} onChange={b => onChange({ ...photos, [k]: b })} />
      ))}
      {docs && DOCS.map(([k, label]) => (
        <PhotoInput key={k} label={label} allowGallery value={photos[k] ?? null} onChange={b => onChange({ ...photos, [k]: b })} />
      ))}
    </div>
  );
}
