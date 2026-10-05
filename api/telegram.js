// Vercel Serverless Function: gửi tin Telegram khi tài xế vào ca / sạc điện (cấp nhiên liệu) / kết thúc ca.
// Biến môi trường (Vercel → Settings → Environment Variables, KHÔNG dùng tiền tố VITE_):
//   TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Mã chat (group) được cài trong app: Quản lý → Cài đặt → Telegram.
import { createClient } from '@supabase/supabase-js';
import { getBotInfo, sendToTelegram } from './_telegram.js';
import { deliver, EVENTS, sweep } from './_deliver.js';

const fail = (res, code, error) => res.status(code).json({ error });

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, TELEGRAM_BOT_TOKEN: token } = process.env;
  if (!url || !key) return fail(res, 500, 'Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY');

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data: caller } = await admin.auth.getUser(bearer);
  if (!caller?.user) return fail(res, 401, 'Chưa đăng nhập');
  const { data: me } = await admin.from('profiles').select('role, active').eq('id', caller.user.id).single();
  if (!me || me.active === false) return fail(res, 403, 'Tài khoản không hoạt động');
  const isManager = me.role === 'manager';

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const ctx = { admin, token, uid: caller.user.id, isManager };

  try {
    // ---- Tài xế (hoặc quản lý) báo một sự kiện vừa xảy ra
    if (b.action === 'notify') {
      if (!EVENTS.includes(b.event) || !b.id) return fail(res, 400, 'Thiếu sự kiện hoặc id');
      return res.json(await deliver(ctx, b.event, String(b.id)));
    }

    // ---- Các thao tác sau chỉ dành cho quản lý
    if (!isManager) return fail(res, 403, 'Chỉ quản lý mới có quyền này');

    if (b.action === 'status') {
      if (!token) return res.json({ tokenConfigured: false });
      try { const bot = await getBotInfo(token); return res.json({ tokenConfigured: true, bot: bot.username }); }
      catch (e) { return res.json({ tokenConfigured: true, tokenError: e.message }); }
    }

    if (b.action === 'test') {
      if (!token) return fail(res, 400, 'Chưa cấu hình TELEGRAM_BOT_TOKEN trên Vercel');
      if (!b.chat_id) return fail(res, 400, 'Thiếu chat ID');
      const id = await sendToTelegram({ token, chatId: b.chat_id, text: '✅ Tin thử từ FleetOps — bot đã gửi được vào nhóm này.' });
      await admin.from('telegram_log').insert({ event: 'test', ref_id: null, chat_id: String(b.chat_id), status: 'sent', message_id: id });
      return res.json({ ok: true });
    }

    if (b.action === 'resend') {
      const { data: row } = await admin.from('telegram_log').select('event, ref_id, status').eq('id', b.log_id).single();
      if (!row || row.status !== 'failed' || !EVENTS.includes(row.event)) return fail(res, 400, 'Không có tin lỗi nào để gửi lại');
      return res.json(await deliver(ctx, row.event, row.ref_id));
    }

    if (b.action === 'sweep') return res.json(await sweep(ctx, Number(b.hours) || 48));

    return fail(res, 400, 'Hành động không hợp lệ');
  } catch (e) {
    return fail(res, 500, e.message || 'Lỗi server');
  }
}
