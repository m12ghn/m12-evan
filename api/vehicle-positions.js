// Vercel Serverless Function: vị trí GPS mới nhất của xe (Bình Anh, gps3.binhanh.vn).
// Biến môi trường (Vercel → Settings → Environment Variables, KHÔNG dùng tiền tố VITE_):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BINHANH_USER, BINHANH_PASS
// Chỉ quản lý/dev đã đăng nhập mới gọi được. Tài khoản Bình Anh không bao giờ ra trình duyệt.
import { createClient } from '@supabase/supabase-js';

const BASE = 'https://gps3.binhanh.vn';
const LIST_TTL_MS = 120_000; // gộp các lần gọi trong 2 phút, tránh dồn tải lên Bình Anh
const norm = p => String(p || '').toUpperCase().replace(/_C$/, '').replace(/[^A-Z0-9]/g, '');
const fail = (res, code, error) => res.status(code).json({ error });

// Bộ nhớ tạm theo instance (mất khi cold start: chỉ tốn thêm 1 lần đăng nhập)
let tokenCache = { token: '', exp: 0 };
let listCache = { at: 0, data: null };

const jwtExp = t => { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).exp * 1000 || 0; } catch { return 0; } };

async function publicIp() {
  try { return (await (await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(4000) })).text()).trim(); } catch { return ''; }
}

async function bhLogin() {
  const { BINHANH_USER: u, BINHANH_PASS: p } = process.env;
  if (!u || !p) throw new Error('Server chưa cấu hình BINHANH_USER / BINHANH_PASS');
  const r = await fetch(`${BASE}/api/v1/authentication/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ UserName: u, Password: p, IPClient: await publicIp(), AppType: 0, ClientType: 1, deviceID: 'fleetops-vercel' }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = await r.json().catch(() => null);
  const d = j && j.data;
  // Bình Anh không đặt tên khóa cố định: lấy giá trị nào có dạng JWT
  const JWT = /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*$/;
  const tok = (d && typeof d === 'object' ? Object.values(d) : []).find(v => typeof v === 'string' && JWT.test(v)) || '';
  if (!tok) throw new Error('Bình Anh từ chối đăng nhập (có thể cần OTP / sai mật khẩu / bị khóa)');
  tokenCache = { token: tok, exp: jwtExp(tok) || Date.now() + 3600_000 };
}

async function bhList(retry = true) {
  if (!tokenCache.token || tokenCache.exp - Date.now() < 300_000) await bhLogin();
  const r = await fetch(`${BASE}/api/v1/vehicleonline/list`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCache.token}` },
    body: JSON.stringify({ getObd2: false }), signal: AbortSignal.timeout(25_000),
  });
  if ((r.status === 401 || r.status === 403) && retry) { tokenCache = { token: '', exp: 0 }; return bhList(false); }
  if (!r.ok) throw new Error(`Bình Anh trả lỗi ${r.status}`);
  const j = await r.json();
  return Array.isArray(j?.data) ? j.data : [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return fail(res, 405, 'Method not allowed');
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) return fail(res, 500, 'Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return fail(res, 401, 'Chưa đăng nhập');
  const { data: me } = await admin.from('profiles').select('role').eq('id', caller.user.id).single();
  if (me?.role !== 'manager' && me?.role !== 'dev') return fail(res, 403, 'Chỉ quản lý mới có quyền này');

  try {
    if (!listCache.data || Date.now() - listCache.at > LIST_TTL_MS) listCache = { at: Date.now(), data: await bhList() };
    const now = Date.now();
    const positions = {};
    for (const v of listCache.data) {
      if (v.latitude == null || v.longitude == null || !v.vehiclePlate) continue;
      const k = norm(v.vehiclePlate);
      const t = Date.parse(`${String(v.gpsTime).slice(0, 19)}+07:00`); // giờ GPS là giờ Việt Nam
      const cur = positions[k];
      if (cur && cur.t >= t) continue;
      positions[k] = { lat: v.latitude, lon: v.longitude, speed: v.velocity ?? 0, t: Number.isFinite(t) ? t : 0 };
    }
    // Chỉ trả các trường cần thiết (không trả tài xế/SĐT/GPLX trong dữ liệu Bình Anh)
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ fetchedAt: listCache.at, now, positions });
  } catch (e) {
    return fail(res, 502, `Không lấy được vị trí: ${String(e.message || e).slice(0, 160)}`);
  }
}
