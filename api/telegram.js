// Vercel Serverless Function: gửi tin Telegram khi tài xế vào ca / sạc điện (cấp nhiên liệu) / kết thúc ca.
// Biến môi trường (Vercel → Settings → Environment Variables, KHÔNG dùng tiền tố VITE_):
//   TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Mã chat (group) được cài trong app: Quản lý → Cài đặt → Telegram.
import { createClient } from '@supabase/supabase-js';
import { buildMessage, getBotInfo, PHOTO_ORDER, sendToTelegram } from './_telegram.js';

const fail = (res, code, error) => res.status(code).json({ error });
const EVENTS = ['checkin', 'refuel', 'checkout'];
const CHAT_KEY = { checkin: 'checkin_chat', refuel: 'refuel_chat', checkout: 'checkout_chat' };

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

async function getSettings(admin) {
  const { data } = await admin.from('app_settings').select('value').eq('key', 'telegram').maybeSingle();
  return data?.value ?? {};
}

/** Gửi 1 sự kiện (idempotent: mỗi (sự kiện, id) chỉ gửi thành công 1 lần). */
async function deliver({ admin, token, uid, isManager }, event, id) {
  if (!token) return { skipped: 'no_token' };
  const settings = await getSettings(admin);
  if (!settings.enabled) return { skipped: 'disabled' };
  const chatId = settings[CHAT_KEY[event]] || settings.default_chat;
  if (!chatId) return { skipped: 'no_chat' };

  // 1) Lấy dữ liệu từ DB (không tin nội dung do trình duyệt gửi lên)
  let trip, refuel;
  if (event === 'refuel') {
    ({ data: refuel } = await admin.from('refuels').select('*').eq('id', id).maybeSingle());
    if (!refuel) return { skipped: 'not_found' };
    ({ data: trip } = await admin.from('trips').select('vehicle_id').eq('id', refuel.trip_id).maybeSingle());
  } else {
    ({ data: trip } = await admin.from('trips').select('*').eq('id', id).maybeSingle());
    if (!trip) return { skipped: 'not_found' };
    if (event === 'checkout' && trip.status !== 'completed') return { skipped: 'not_finished' };
  }
  const driverId = refuel ? refuel.driver_id : trip.driver_id;
  if (!isManager && driverId !== uid) return { forbidden: true };

  const [{ data: vehicle }, { data: prof }] = await Promise.all([
    admin.from('vehicles').select('plate, energy_type').eq('id', trip.vehicle_id).maybeSingle(),
    admin.from('profiles').select('full_name, email').eq('id', driverId).maybeSingle(),
  ]);
  const name = prof?.full_name || (prof?.email ?? '').replace('@fleetops.local', '') || '—';
  const text = buildMessage(event, { name, plate: vehicle?.plate, energyType: vehicle?.energy_type, trip, refuel });

  // 2) Giữ chỗ trong nhật ký để 2 yêu cầu cùng lúc không gửi trùng
  await admin.from('telegram_log').delete().eq('event', event).eq('ref_id', id).eq('status', 'pending')
    .lt('at', new Date(Date.now() - 2 * 60_000).toISOString());       // bản giữ chỗ cũ (hàm từng bị ngắt giữa chừng)
  const { data: slot, error: slotErr } = await admin.from('telegram_log')
    .insert({ event, ref_id: id, chat_id: String(chatId), status: 'pending' }).select('id').single();
  if (slotErr) return { skipped: 'already_sent' };

  // 3) Gửi
  try {
    const keys = PHOTO_ORDER[event === 'refuel' ? `refuel_${refuel.energy_type === 'electric' ? 'electric' : 'fuel'}` : event];
    const map = (refuel ? refuel.photos : event === 'checkin' ? trip.photos_start : trip.photos_end) ?? {};
    const photos = (await Promise.all(keys.filter(k => map[k]).map(async k => {
      const { data: blob, error } = await admin.storage.from('photos').download(map[k]);
      return error || !blob ? null : { name: `${k}.jpg`, blob };
    }))).filter(Boolean);
    const messageId = await sendToTelegram({ token, chatId, text, photos });
    await admin.from('telegram_log').update({ status: 'sent', message_id: messageId, error: null }).eq('id', slot.id);
    return { ok: true, photos: photos.length };
  } catch (e) {
    await admin.from('telegram_log').update({ status: 'failed', error: String(e.message).slice(0, 300) }).eq('id', slot.id);
    return { failed: true, error: e.message };
  }
}

/** Quét các sự kiện gần đây chưa gửi (vd. tài xế mất mạng ngay sau khi gửi) và gửi bù. */
async function sweep(ctx, hours) {
  const { admin } = ctx;
  const settings = await getSettings(admin);
  if (!ctx.token) return { error: 'Chưa cấu hình TELEGRAM_BOT_TOKEN trên Vercel' };
  if (!settings.enabled) return { error: 'Gửi tin Telegram đang tắt' };
  const since = new Date(Date.now() - Math.min(hours, 168) * 3600_000).toISOString();

  const [t1, t2, r] = await Promise.all([
    admin.from('trips').select('id').gte('start_time', since),
    admin.from('trips').select('id').eq('status', 'completed').gte('end_time', since),
    admin.from('refuels').select('id').gte('created_at', since),
  ]);
  const wanted = [
    ...(t1.data ?? []).map(x => ['checkin', x.id]), ...(t2.data ?? []).map(x => ['checkout', x.id]), ...(r.data ?? []).map(x => ['refuel', x.id]),
  ];
  const { data: done } = await admin.from('telegram_log').select('event, ref_id').eq('status', 'sent').gte('at', since);
  const sent = new Set((done ?? []).map(x => `${x.event}:${x.ref_id}`));
  const todo = wanted.filter(([e, id]) => !sent.has(`${e}:${id}`));

  const BATCH = 4; // mỗi lần gửi vài tin để không vượt thời gian của hàm
  let ok = 0, failed = 0;
  for (const [event, id] of todo.slice(0, BATCH)) {
    const r2 = await deliver(ctx, event, id);
    if (r2.ok) ok++; else if (r2.failed) failed++;
  }
  return { ok, failed, remaining: Math.max(0, todo.length - BATCH) };
}
