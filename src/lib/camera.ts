// Chụp ảnh ngay trong trang (getUserMedia) thay vì mở app camera ngoài:
// trên Android, mở app camera khiến Chrome bị tắt tab (thiếu RAM) và mất ảnh vừa chụp.
const MAX_SIDE = 1280;

export const cameraSupported = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

export async function openStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
    });
  } catch (e) {
    if ((e as DOMException).name === 'NotAllowedError') throw e; // người dùng từ chối quyền: không thử lại
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
}

export const stopStream = (s: MediaStream) => s.getTracks().forEach(t => t.stop());

// Lấy 1 khung hình từ video, thu nhỏ còn tối đa 1280px, nén JPEG
export async function grabFrame(video: HTMLVideoElement, quality = 0.85): Promise<Blob> {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) throw new Error('Camera chưa sẵn sàng');
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error('Không chụp được ảnh');
  return blob;
}
