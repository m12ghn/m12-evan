import { useEffect, useRef, useState } from 'react';
import { grabFrame, openStream, stopStream } from '../lib/camera';

interface Props { label: string; onCapture: (b: Blob) => void; onClose: () => void; onUnavailable: () => void }

export default function CameraCapture({ label, onCapture, onClose, onUnavailable }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dead = false;
    let stream: MediaStream | undefined;
    openStream().then(async s => {
      if (dead) { stopStream(s); return; }
      stream = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      if (!dead) setReady(true);
    }).catch(() => { if (!dead) onUnavailable(); });
    return () => { dead = true; if (stream) stopStream(stream); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function shoot() {
    setBusy(true);
    try { onCapture(await grabFrame(video.current!)); } catch { setBusy(false); }
  }

  return (
    <div className="cam">
      <video ref={video} playsInline muted autoPlay />
      <div className="cam-top"><b>{label}</b><button type="button" onClick={onClose} aria-label="Đóng">✕</button></div>
      {!ready && <p className="cam-wait">Đang mở camera…</p>}
      <div className="cam-bottom"><button type="button" className="shutter" disabled={!ready || busy} onClick={shoot} aria-label="Chụp" /></div>
    </div>
  );
}
