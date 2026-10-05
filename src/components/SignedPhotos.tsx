import { useEffect, useState } from 'react';
import { signPhotoMap, type PhotoMap } from '../lib/storage';

export default function SignedPhotos({ photos, labels }: { photos: PhotoMap | null; labels: Record<string, string> }) {
  const [urls, setUrls] = useState<PhotoMap>({});
  // Khóa theo nội dung (không theo tham chiếu) để không ký lại URL và nháy ảnh mỗi lần trang render lại
  const key = JSON.stringify(photos);
  useEffect(() => { let alive = true; signPhotoMap(photos).then(u => alive && setUrls(u)); return () => { alive = false; }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
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
