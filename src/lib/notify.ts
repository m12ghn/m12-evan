import { supabase } from './supabase';

export type TgEvent = 'checkin' | 'refuel' | 'checkout';

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return `Bearer ${data.session?.access_token ?? ''}`;
}

/** Báo cho máy chủ gửi tin Telegram. Chạy ngầm: lỗi không làm hỏng thao tác của tài xế
 *  (nếu lỡ mất thì quản lý bấm "Quét & gửi bù" trong Cài đặt → Telegram). */
export function notifyTelegram(event: TgEvent, id: string) {
  authHeader()
    .then(h => fetch('/api/telegram', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: h },
      body: JSON.stringify({ action: 'notify', event, id }),
    }))
    .catch(() => {});
}

/** Gọi các thao tác quản lý của /api/telegram (trạng thái bot, tin thử, gửi lại, quét gửi bù). */
export async function telegramApi<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const r = await fetch('/api/telegram', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: await authHeader() }, body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Lỗi ${r.status}`);
  return j as T;
}
