# FleetOps — Quản lý xe, ODO & nhiên liệu

Một link duy nhất, đăng nhập xong hệ thống tự chuyển theo **role**:
- `manager` → trang **Quản lý** (`/manager`): đội xe, nhật ký ca, duyệt nhiên liệu.
- `driver` → trang **Tài xế** (`/driver`): nhận xe, đổ nhiên liệu, trả xe.

Stack: Vite + React + TypeScript · Supabase (Auth, Postgres, Storage) · Vercel · GitHub.

## Cấu trúc
```
prototype/   Bản gốc HTML/JS (localStorage) — nguồn để port logic & giao diện
src/         App React (Login, ManagerHome, DriverHome, auth theo role)
supabase/    schema.sql (bảng + RLS + storage), seed.sql
```

## Thiết lập
1. **Supabase**: tạo project → SQL Editor chạy `supabase/schema.sql`, rồi `supabase/seed.sql`.
2. Tạo user ở Authentication → Users. Tài xế dùng email dạng `<MSNV>@fleetops.local` (ví dụ `12345@fleetops.local`) và đăng nhập chỉ cần gõ MSNV; nhớ tick *Auto Confirm User*. Đặt `full_name` trong user metadata. Mặc định ai cũng là `driver`; nâng quản lý:
   ```sql
   update profiles set role = 'manager' where id = '<user-uuid>';
   ```
3. Chạy local:
   ```bash
   cp .env.example .env   # điền URL + anon key
   npm install && npm run dev
   ```
4. **Vercel**: Import repo này từ GitHub (Framework: Vite, Root Directory để trống), thêm 2 biến môi trường `SUPABASE_URL`, `SUPABASE_ANON_KEY` (không cần tiền tố VITE_). Mỗi lần push là tự deploy.

## Việc tiếp theo
- ✅ Tab tài xế đã làm: Chụp hình đầu ca, Cấp nhiên liệu / Cấp điện (một phiếu chung, xe dầu = lít, xe điện = kWh theo `vehicles.energy_type`), Chụp hình cuối ca.
- Port các tab quản lý (nhật ký ca, so sánh ảnh, duyệt phiếu, cài đặt xe/tài xế) sang `ManagerHome`.
- Siết RLS cập nhật `vehicles` của tài xế bằng RPC.

## Quy ước (bắt chước gxt-driver-truck)
- **Màu/giao diện**: teal GHN `#0F9B94`, font Roboto, bo góc 12, nút gradient; trang tài xế giới hạn 480px. Biến CSS ở đầu `src/styles.css`.
- **Lưu ảnh**: file trên Supabase Storage (bucket `photos`, tối đa 5MB), DB chỉ lưu đường dẫn trong cột jsonb (`photos_start`, `photos_end`), đọc lại bằng signed URL 7 ngày (`src/lib/storage.ts`).
