// Webhook do CƠ SỞ DỮ LIỆU gọi (trigger + pg_net) ngay khi có ca/phiếu mới, và pg_cron gọi quét bù mỗi 5 phút.
// Xác thực bằng mã bí mật chung: biến Vercel TELEGRAM_HOOK_SECRET phải trùng mã đã lưu ở Cài đặt → Telegram.
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { deliver, EVENTS, sweep } from './_deliver.js';

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const fail = (res, code, error) => res.status(code).json({ error });

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, TELEGRAM_BOT_TOKEN: token, TELEGRAM_HOOK_SECRET: secret } = process.env;
  if (!secret) return fail(res, 503, 'Chưa cấu hình TELEGRAM_HOOK_SECRET');
  if (!url || !key) return fail(res, 500, 'Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY');

  const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!crypto.timingSafeEqual(sha(given), sha(secret))) return fail(res, 401, 'Sai mã bí mật');

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const ctx = { admin, token, uid: null, isManager: true };

  try {
    if (b.action === 'ping') return res.json({ ok: true });
    if (b.action === 'sweep') return res.json(await sweep(ctx, 48));
    if (EVENTS.includes(b.event) && b.id) return res.json(await deliver(ctx, b.event, String(b.id)));
    return fail(res, 400, 'Yêu cầu không hợp lệ');
  } catch (e) {
    return fail(res, 500, e.message || 'Lỗi server');
  }
}
