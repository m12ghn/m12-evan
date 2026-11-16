import { supabase } from './supabase';

export interface BtbdSync { ok: boolean; at: string; sheetRows: number; withMark: number; matched: number; changed: number; unmatched: number }

/** Gọi /api/sync-btbd: máy chủ tự đọc Google Sheet (BTBD_SHEET_URL) và cập nhật mốc bảo dưỡng của xe. */
export async function syncBtbd(): Promise<BtbdSync> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch('/api/sync-btbd', { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Lỗi ${r.status}`);
  return j as BtbdSync;
}
