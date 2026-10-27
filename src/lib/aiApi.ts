import { supabase } from './supabase';

/** Gọi /api/extract-charges: AI đọc một lô ảnh hóa đơn sạc điện trong khoảng ngày (from, to dạng YYYY-MM-DD). */
export async function aiApi<T>(payload: { from: string; to: string; force?: boolean }): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch('/api/extract-charges', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Lỗi ${r.status}`);
  return j as T;
}
