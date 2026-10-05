import { supabase } from './supabase';

type Payload =
  | { action: 'create'; username: string; password: string; full_name?: string; phone?: string; license?: string; role: 'manager' | 'driver' }
  | { action: 'update'; id: string; username?: string; password?: string }
  | { action: 'set_active'; id: string; active: boolean };

// Gọi Vercel Function /api/admin-users (chạy ở server với khóa service_role)
export async function adminUsers(payload: Payload) {
  const { data } = await supabase.auth.getSession();
  const r = await fetch('/api/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Lỗi ${r.status}`);
  return j;
}

export const usernameOf = (email: string | null) =>
  !email ? '' : email.endsWith('@fleetops.local') ? email.replace('@fleetops.local', '') : email;
