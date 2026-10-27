// Vercel Serverless Function: AI đọc ảnh hóa đơn / lịch sử sạc điện của các phiếu sạc trong khoảng ngày, lưu vào bảng refuel_ai.
// Biến môi trường (Vercel, KHÔNG dùng tiền tố VITE_): ANTHROPIC_API_KEY hoặc GEMINI_API_KEY (một trong hai; AI_PROVIDER=gemini để ép dùng Gemini), ANTHROPIC_MODEL (tùy chọn), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';
import { readReceipt, readReceiptGemini, toRecord } from './_extract.js';

const fail = (res, code, error) => res.status(code).json({ error });
const DAY = /^\d{4}-\d{2}-\d{2}$/;
// Ngày theo giờ Việt Nam (UTC+7)
const vnStart = d => new Date(`${d}T00:00:00+07:00`).toISOString();
const vnAfter = d => new Date(new Date(`${d}T00:00:00+07:00`).getTime() + 86400_000).toISOString();

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  // Chọn nhà cung cấp AI: có GEMINI_API_KEY (và AI_PROVIDER=gemini hoặc không có khóa Anthropic) → Gemini; ngược lại Claude
  const gemini = process.env.AI_PROVIDER === 'gemini' || (!process.env.ANTHROPIC_API_KEY && !!process.env.GEMINI_API_KEY);
  const apiKey = gemini ? process.env.GEMINI_API_KEY : process.env.ANTHROPIC_API_KEY;
  const model = gemini ? (process.env.GEMINI_MODEL || 'gemini-2.5-flash') : (process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5');
  if (!url || !key) return fail(res, 500, 'Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey) return fail(res, 500, `Chưa cấu hình ${gemini ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY (hoặc GEMINI_API_KEY)'} trên Vercel`);

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data: caller } = await admin.auth.getUser(bearer);
  if (!caller?.user) return fail(res, 401, 'Chưa đăng nhập');
  const { data: me } = await admin.from('profiles').select('role, active').eq('id', caller.user.id).single();
  if (!me || me.active === false || !['manager', 'dev'].includes(me.role)) return fail(res, 403, 'Chỉ quản lý mới có quyền này');

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (!DAY.test(b.from ?? '') || !DAY.test(b.to ?? '') || b.from > b.to) return fail(res, 400, 'Khoảng ngày không hợp lệ');
  const batch = Math.min(Math.max(Number(b.batch) || 4, 1), 6);

  try {
    // Phiếu sạc điện trong khoảng ngày (trừ phiếu bị từ chối)
    const wanted = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await admin.from('refuels').select('id, photos, created_at').eq('energy_type', 'electric').neq('status', 'rejected')
        .gte('created_at', vnStart(b.from)).lt('created_at', vnAfter(b.to)).order('created_at').range(from, from + 999);
      if (error) throw error;
      wanted.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    // Đã đọc xong (ok / unreadable) thì bỏ qua, trừ khi force; 'error' được thử lại
    const doneIds = new Set();
    if (!b.force) {
      for (let i = 0; i < wanted.length; i += 100) {
        const { data } = await admin.from('refuel_ai').select('refuel_id').in('refuel_id', wanted.slice(i, i + 100).map(x => x.id)).in('status', ['ok', 'unreadable']);
        (data ?? []).forEach(x => doneIds.add(x.refuel_id));
      }
    }
    const todo = wanted.filter(x => !doneIds.has(x.id));
    const now = todo.slice(0, batch);
    const stat = { ok: 0, unreadable: 0, error: 0 };

    await Promise.all(now.map(async r => {
      let rec;
      try {
        const paths = [r.photos?.receipt, r.photos?.after].filter(Boolean);
        const images = [];
        for (const p of paths) {
          const { data: blob } = await admin.storage.from('photos').download(p);
          if (blob) images.push(Buffer.from(await blob.arrayBuffer()));
        }
        // Không có ảnh hóa đơn nào tải được → coi như không đọc được
        rec = images.length ? toRecord(await (gemini ? readReceiptGemini({ apiKey, model, images }) : readReceipt({ apiKey, model, images, base: process.env.ANTHROPIC_API_BASE || undefined })), model)
          : toRecord({ readable: false }, model);
      } catch (e) {
        rec = { status: 'error', station: null, amount: null, kwh: null, charged_at: null, invoice_no: null, raw: null, model, error: String(e.message).slice(0, 250) };
      }
      stat[rec.status]++;
      await admin.from('refuel_ai').upsert({ refuel_id: r.id, ...rec, created_at: new Date().toISOString() });
    }));
    // Lỗi thì lần sau thử lại nên vẫn nằm trong "còn lại"
    return res.json({ total: wanted.length, processed: now.length, ...stat, remaining: Math.max(0, todo.length - now.length + stat.error) });
  } catch (e) {
    return fail(res, 500, e.message || 'Lỗi server');
  }
}
