// Nén ảnh chụp từ điện thoại (3–10MB) xuống JPEG ~1280px trước khi upload (như bản gốc).
export async function compressImage(file: File, maxSide = 1280, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('Nén ảnh lỗi'))), 'image/jpeg', quality));
}
