// Vercel Serverless Function: quản lý tài khoản (cần khóa service_role nên chỉ chạy ở server).
// Biến môi trường (Vercel → Settings → Environment Variables, KHÔNG dùng tiền tố VITE_):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';

const DOMAIN = '@fleetops.local';
const toEmail = u => (u.includes('@') ? u.trim().toLowerCase() : `${u.trim().toLowerCase()}${DOMAIN}`);
const validUser = u => typeof u === 'string' && /^[A-Za-z0-9._-]{2,40}(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})?$/.test(u.trim());
const fail = (res, code, error) => res.status(code).json({ error });
const friendly = m => (/already|registered|exists/i.test(m) ? 'Tên đăng nhập đã tồn tại' : m);

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) return fail(res, 500, 'Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY');

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Chỉ quản lý (role=manager) mới được gọi
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return fail(res, 401, 'Chưa đăng nhập');
  const { data: me } = await admin.from('profiles').select('role').eq('id', caller.user.id).single();
  if (me?.role !== 'manager') return fail(res, 403, 'Chỉ quản lý mới có quyền này');

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  try {
    if (b.action === 'create') {
      if (!validUser(b.username)) return fail(res, 400, 'Tên đăng nhập không hợp lệ (chữ, số, . _ -)');
      if (!b.password || b.password.length < 6) return fail(res, 400, 'Mật khẩu tối thiểu 6 ký tự');
      const email = toEmail(b.username);
      const { data, error } = await admin.auth.admin.createUser({
        email, password: b.password, email_confirm: true, user_metadata: { full_name: b.full_name || null },
      });
      if (error) return fail(res, 400, friendly(error.message));
      const role = b.role === 'manager' ? 'manager' : 'driver';
      const { error: pErr } = await admin.from('profiles').update({
        role, email, full_name: b.full_name || null, phone: b.phone || null, license: b.license || null,
      }).eq('id', data.user.id);
      if (pErr) {
        await admin.auth.admin.deleteUser(data.user.id); // không để lại tài khoản dở dang
        return fail(res, 500, `Không lưu được hồ sơ (${pErr.message}). Đã chạy supabase/migration-002-profile-email.sql chưa?`);
      }
      return res.json({ ok: true, id: data.user.id });
    }

    if (b.action === 'update') {
      if (!b.id) return fail(res, 400, 'Thiếu id người dùng');
      const patch = { email_confirm: true };
      if (b.username) {
        if (!validUser(b.username)) return fail(res, 400, 'Tên đăng nhập không hợp lệ (chữ, số, . _ -)');
        patch.email = toEmail(b.username);
      }
      if (b.password) {
        if (b.password.length < 6) return fail(res, 400, 'Mật khẩu tối thiểu 6 ký tự');
        patch.password = b.password;
      }
      if (!patch.email && !patch.password) return fail(res, 400, 'Không có gì để cập nhật');
      const { error } = await admin.auth.admin.updateUserById(b.id, patch);
      if (error) return fail(res, 400, friendly(error.message));
      if (patch.email) {
        const { error: pErr } = await admin.from('profiles').update({ email: patch.email }).eq('id', b.id);
        if (pErr) return fail(res, 500, `Đã đổi đăng nhập nhưng không lưu được hồ sơ (${pErr.message}). Chạy supabase/migration-002-profile-email.sql rồi thử lại.`);
      }
      return res.json({ ok: true });
    }

    return fail(res, 400, 'Hành động không hợp lệ');
  } catch (e) {
    return fail(res, 500, e.message || 'Lỗi server');
  }
}
