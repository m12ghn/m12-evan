import { supabase } from './supabase';

// Cách lưu ảnh (theo gxt-driver-truck): file nằm trên Supabase Storage, DB chỉ lưu đường dẫn
// trong jsonb {taplo, front, back, left, right}. Khi hiển thị thì tạo signed URL (hiệu lực 7 ngày).
export const BUCKET = 'photos';
export const SIGNED_URL_TTL = 60 * 60 * 24 * 7;
export type PhotoFolder = 'checkin' | 'checkout' | 'refuel' | 'accident';
export type PhotoMap = Record<string, string>;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
// Ảnh đã tải lên thành công: nếu gửi lại sau khi lỗi mạng thì dùng lại đường dẫn, không tải trùng
const uploaded = new WeakMap<Blob, string>();

// Đường dẫn: <user_id>/<folder>/<timestamp>-<uuid>.jpg (thư mục đầu = user_id để khớp RLS)
export async function uploadPhoto(userId: string, folder: PhotoFolder, file: Blob): Promise<string> {
  const done = uploaded.get(file);
  if (done) return done;
  const path = `${userId}/${folder}/${Date.now()}-${crypto.randomUUID()}.jpg`;
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {           // mạng di động hay chập chờn → thử lại tối đa 3 lần
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'image/jpeg', upsert: true });
    if (!error) { uploaded.set(file, path); return path; }
    lastError = error.message;
    await sleep(600 * (attempt + 1));
  }
  throw new Error(`Upload ảnh thất bại: ${lastError}`);
}

/** Tải nhiều ảnh song song (tối đa 3 ảnh cùng lúc), báo tiến độ qua onProgress(đã xong, tổng). */
export async function uploadPhotos<K extends string | number>(
  userId: string, folder: PhotoFolder, entries: [K, Blob][], onProgress?: (done: number, total: number) => void,
): Promise<Record<K, string>> {
  const out = {} as Record<K, string>;
  let next = 0, done = 0;
  onProgress?.(0, entries.length);
  const worker = async () => {
    while (next < entries.length) {
      const [k, blob] = entries[next++];
      out[k] = await uploadPhoto(userId, folder, blob);
      onProgress?.(++done, entries.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, entries.length) }, worker));
  return out;
}

export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return error || !data ? '' : data.signedUrl;
}

/** Ký URL cho cả bộ ảnh trong MỘT yêu cầu (trước đây mỗi ảnh một yêu cầu). */
export async function signPhotoMap(photos: PhotoMap | null): Promise<PhotoMap> {
  const entries = Object.entries(photos ?? {}).filter(([, p]) => p);
  if (!entries.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(entries.map(([, p]) => p), SIGNED_URL_TTL);
  if (error || !data) return {};
  const byPath = new Map(data.map(d => [d.path, d.signedUrl]));
  return Object.fromEntries(entries.map(([k, p]) => [k, byPath.get(p) ?? '']));
}
