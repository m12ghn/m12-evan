import { useEffect, useState } from 'react';
import { signPhotoMap, type PhotoMap } from '../lib/storage';

export default function SignedPhotos({ photos, labels }: { photos: PhotoMap | null; labels: Record<string, string> }) {
  const [urls, setUrls] = useState<PhotoMap>({});
  useEffect(() => { signPhotoMap(photos).then(setUrls); }, [photos]);
  const keys = Object.keys(labels).filter(k => photos?.[k]);
  if (!keys.length) return <p className="muted">Không có ảnh</p>;
  return (
    <div className="thumbs">
      {keys.map(k => urls[k] ? (
        <a key={k} href={urls[k]} target="_blank" rel="noreferrer"><img src={urls[k]} alt={labels[k]} /><small>{labels[k]}</small></a>
      ) : <div key={k} className="muted">{labels[k]}…</div>)}
    </div>
  );
}
export const TRIP_LABELS = { taplo: 'Taplo', front: 'Đầu xe', back: 'Đuôi xe', left: 'Sườn trái', right: 'Sườn phải' };
