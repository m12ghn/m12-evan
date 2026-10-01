// Nén ảnh chụp từ điện thoại (3–10MB) xuống JPEG ~1280px trước khi upload.
// Tiết kiệm RAM cho máy Android yếu: yêu cầu trình duyệt giải mã THẲNG ở kích thước nhỏ
// (không dựng ảnh gốc hàng chục megapixel) và giải phóng bitmap ngay sau khi vẽ.
const MAX_SIDE = 1280;

// Đọc kích thước từ phần đầu file (không giải mã toàn bộ ảnh)
function dimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { res({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Không đọc được ảnh')); };
    img.src = url;
  });
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    const { w, h } = await dimensions(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    if (scale < 1) {
      return await createImageBitmap(file, { resizeWidth: Math.round(w * scale), resizeHeight: Math.round(h * scale), resizeQuality: 'medium' });
    }
  } catch { /* rơi xuống cách giải mã thông thường */ }
  return createImageBitmap(file);
}

export async function compressImage(file: File, quality = 0.8): Promise<Blob> {
  const bmp = await decode(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
    canvas.width = canvas.height = 0; // trả bộ nhớ canvas
    if (!blob) throw new Error('Nén ảnh lỗi');
    return blob;
  } finally {
    bmp.close();
  }
}
