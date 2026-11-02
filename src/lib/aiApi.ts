import { supabase } from './supabase';

/** Gọi /api/extract-charges: AI đọc một lô ảnh hóa đơn sạc điện trong khoảng ngày (from, to dạng YYYY-MM-DD).
 *  Tự thử lại tối đa 3 lần khi máy chủ quá hạn (502/503/504) hoặc mất mạng. */
export async function aiApi<T>(payload: { from: string; to: string; force?: boolean }): Promise<T> {
  let lastErr = 'Lỗi không rõ';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch('/api/extract-charges', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify(payload),
      });
      if ([502, 503, 504].includes(r.status)) { lastErr = `Máy chủ quá hạn (${r.status})`; await new Promise(s => setTimeout(s, 2000 * (attempt + 1))); continue; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? `Lỗi ${r.status}`);
      return j as T;
    } catch (e) {
      const m = (e as Error).message;
      if (!/Failed to fetch|NetworkError|Load failed/i.test(m)) throw e;   // chỉ thử lại khi mất mạng
      lastErr = 'Mất kết nối mạng'; await new Promise(s => setTimeout(s, 2000 * (attempt + 1)));
    }
  }
  throw new Error(`${lastErr}. Đã thử lại 3 lần; bấm lại 🤖 AI đọc hóa đơn để chạy tiếp (phần đã đọc được giữ nguyên).`);
}
