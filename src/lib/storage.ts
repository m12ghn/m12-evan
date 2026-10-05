import { supabase } from './supabase';

// Cách lưu ảnh (theo gxt-driver-truck): file nằm trên Supabase Storage, DB chỉ lưu đường dẫn
// trong jsonb {taplo, front, back, left, right}. Khi hiển thị thì tạo signed URL (hiệu lực 7 ngày).
export const BUCKET = 'photos';
export const SIGNED_URL_TTL = 60 * 60 * 24 * 7;
export type PhotoFolder = 'checkin' | 'checkout' | 'refuel' | 'accident';
export type PhotoMap = Record<string, string>;

// Đường dẫn: <user_id>/<folder>/<timestamp>-<uuid>.jpg (thư mục đầu = user_id để khớp RLS)
export async function uploadPhoto(userId: string, folder: PhotoFolder, file: Blob): Promise<string> {
  const path = `${userId}/${folder}/${Date.now()}-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`Upload ảnh thất bại: ${error.message}`);
  return path;
}

export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return error || !data ? '' : data.signedUrl;
}

export async function signPhotoMap(photos: PhotoMap | null): Promise<PhotoMap> {
  if (!photos) return {};
  const entries = await Promise.all(Object.entries(photos).map(async ([k, p]) => [k, await signedUrl(p)] as const));
  return Object.fromEntries(entries);
}
