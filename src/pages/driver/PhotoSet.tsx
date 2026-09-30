import PhotoInput from '../../components/PhotoInput';

export const ANGLES = [
  ['taplo', 'Taplo (ODO + mức NL/pin)'], ['front', 'Đầu xe'], ['back', 'Đuôi xe'], ['left', 'Sườn trái'], ['right', 'Sườn phải'],
] as const;
export type Photos = Partial<Record<(typeof ANGLES)[number][0], Blob>>;
export const photosComplete = (p: Photos) => ANGLES.every(([k]) => p[k]);

export default function PhotoSet({ photos, onChange }: { photos: Photos; onChange: (p: Photos) => void }) {
  return (
    <div className="photo-grid">
      {ANGLES.map(([k, label]) => (
        <PhotoInput key={k} label={label} value={photos[k] ?? null} onChange={b => onChange({ ...photos, [k]: b })} />
      ))}
    </div>
  );
}
