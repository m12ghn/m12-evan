-- Migration 015: kết quả AI đọc ảnh hóa đơn / lịch sử sạc điện. Chạy được nhiều lần.
create table if not exists public.refuel_ai (
  refuel_id uuid primary key references public.refuels(id) on delete cascade,
  status text not null check (status in ('ok','unreadable','error')),  -- ok = đọc được hóa đơn; unreadable = không đọc được (mặc định Sạc tại kho M12); error = lỗi AI, sẽ thử lại
  station text,            -- tên trạm sạc (không đọc được → 'Sạc tại kho M12')
  amount numeric,          -- thành tiền trên hóa đơn (đ)
  kwh numeric,             -- điện năng trên hóa đơn
  charged_at text,         -- ngày giờ ghi trên hóa đơn (nguyên văn)
  invoice_no text,
  raw jsonb,
  model text,
  error text,
  created_at timestamptz not null default now()
);
alter table public.refuel_ai enable row level security;
drop policy if exists "refuel_ai: manager xem" on public.refuel_ai;
create policy "refuel_ai: manager xem" on public.refuel_ai for select using ((select public.is_manager()));
-- Chỉ máy chủ (service_role) ghi; không ai sửa qua app
revoke all on public.refuel_ai from anon, authenticated;
grant select on public.refuel_ai to authenticated;

notify pgrst, 'reload schema';
