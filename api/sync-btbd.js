// Vercel Function: tự đồng bộ mốc bảo dưỡng định kỳ (BTBD) từ Google Sheet vào bảng vehicles.
// Chạy tự động mỗi ngày bằng Vercel Cron (vercel.json), và quản lý bấm "Đồng bộ ngay" trong Cài đặt.
// Biến môi trường (Vercel, KHÔNG dùng tiền tố VITE_):
//   BTBD_SHEET_URL   : địa chỉ CSV của sheet Data BTBD, vd. https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=<GID>
//                      (sheet phải chia sẻ "Bất kỳ ai có đường liên kết đều xem được", hoặc dùng liên kết Xuất bản lên web dạng CSV)
//   CRON_SECRET      : chuỗi bí mật bất kỳ (≥ 16 ký tự); Vercel Cron tự gửi kèm khi gọi
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { buildUpdates, parseCsv } from './_btbd.js';

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const fail = (res, code, error) => res.status(code).json({ error });

export default async function handler(req, res) {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, BTBD_SHEET_URL: sheetUrl, CRON_SECRET: cronSecret } = process.env;
  if (!url || !key) return fail(res, 500, 'Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Xác thực: Vercel Cron (GET + Bearer CRON_SECRET) hoặc quản lý đăng nhập (POST + token)
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let ok = false;
  if (cronSecret && bearer && crypto.timingSafeEqual(sha(bearer), sha(cronSecret))) ok = true;
  else if (req.method === 'POST') {
    const { data: caller } = await admin.auth.getUser(bearer);
    if (caller?.user) {
      const { data: me } = await admin.from('profiles').select('role, active').eq('id', caller.user.id).single();
      ok = Boolean(me) && me.active !== false && ['manager', 'dev'].includes(me.role);
    }
  }
  if (!ok) return fail(res, 401, 'Không có quyền');
  if (!sheetUrl) return fail(res, 400, 'Chưa cấu hình BTBD_SHEET_URL trên Vercel (địa chỉ CSV của sheet Data BTBD).');

  try {
    const r = await fetch(sheetUrl, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
    const text = await r.text();
    if (!r.ok) return fail(res, 502, `Không tải được sheet (mã ${r.status}). Kiểm tra sheet đã chia sẻ cho "bất kỳ ai có đường liên kết" chưa.`);
    if (/<html|<!doctype/i.test(text.slice(0, 300))) return fail(res, 502, 'Google trả về trang đăng nhập thay vì dữ liệu: sheet chưa được chia sẻ công khai (xem hướng dẫn) hoặc đường dẫn sai.');

    const { data: vehicles, error: vErr } = await admin.from('vehicles').select('id, plate, service_next_km');
    if (vErr) throw vErr;
    const out = buildUpdates(parseCsv(text), vehicles ?? []);
    if (out.error) return fail(res, 422, out.error);

    const now = new Date().toISOString(); const errors = [];
    for (let i = 0; i < out.updates.length; i += 15) {
      const rs = await Promise.all(out.updates.slice(i, i + 15).map(u => admin.from('vehicles').update({ ...u.patch, service_synced_at: now }).eq('id', u.id)));
      rs.forEach((x, j) => x.error && errors.push(`${out.updates[i + j].plate}: ${x.error.message}`));
    }
    if (errors.length) return fail(res, 500, `Có ${errors.length} xe lỗi khi lưu: ${errors.slice(0, 3).join('; ')}. Đã chạy SQL migration 020 chưa?`);
    return res.json({ ok: true, at: now, sheetRows: out.sheetRows, withMark: out.withMark, matched: out.updates.length, changed: out.updates.filter(u => u.changed).length, unmatched: out.unmatched.length });
  } catch (e) {
    return fail(res, 500, e.message || 'Lỗi server');
  }
}
