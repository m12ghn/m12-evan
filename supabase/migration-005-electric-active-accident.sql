-- Migration 005: (1) phiếu sạc điện nhập tay thành tiền, (2) trạng thái nghỉ việc, (3) trạng thái xe mới, (4) báo cáo tai nạn
-- Chạy được nhiều lần.

-- (1) Phiếu cấp điện: pin trước/sau, thời gian sạc; thành tiền nhập trực tiếp (không còn tự sinh = số lượng × đơn giá)
alter table public.refuels add column if not exists battery_before int check (battery_before between 0 and 100);
alter table public.refuels add column if not exists battery_after  int check (battery_after  between 0 and 100);
alter table public.refuels add column if not exists charge_minutes int check (charge_minutes > 0);
do $$ begin
  -- chỉ gỡ "generated" nếu cột vẫn còn là cột sinh tự động (giữ nguyên giá trị các phiếu cũ)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='refuels'
             and column_name='total_amount' and is_generated='ALWAYS') then
    alter table public.refuels alter column total_amount drop expression;
  end if;
end $$;
alter table public.refuels alter column total_amount set default 0;

create or replace function public.refuel_total() returns trigger language plpgsql as $$
begin
  if new.total_amount is null or new.total_amount = 0 then
    new.total_amount := round(new.quantity * new.unit_price);
  end if;
  return new;
end $$;
drop trigger if exists refuel_total on public.refuels;
create trigger refuel_total before insert on public.refuels for each row execute function public.refuel_total();

-- (2) Người dùng: Còn làm / Đã nghỉ
alter table public.profiles add column if not exists active boolean not null default true;

create or replace function public.start_trip(
  p_vehicle uuid, p_odo int, p_level int, p_notes text, p_photos jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v public.vehicles; tid uuid;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and active) then raise exception 'Tài khoản đã ngừng hoạt động'; end if;
  if p_odo is null or p_odo < 0 then raise exception 'ODO không hợp lệ'; end if;
  if p_level is null or p_level < 0 or p_level > 100 then raise exception 'Mức nhiên liệu/pin phải từ 0–100'; end if;
  if exists (select 1 from trips where driver_id = auth.uid() and status = 'on_duty') then
    raise exception 'Bạn đang có ca chưa trả xe';
  end if;
  select * into v from vehicles where id = p_vehicle for update;
  if not found then raise exception 'Không tìm thấy xe'; end if;
  if v.status <> 'ready' then raise exception 'Xe không ở trạng thái sẵn sàng (có thể đã có người nhận)'; end if;

  insert into trips (vehicle_id, driver_id, start_odo, start_level, pre_notes, photos_start)
  values (p_vehicle, auth.uid(), p_odo, p_level, nullif(p_notes, ''), p_photos)
  returning id into tid;

  update vehicles set status = 'on_duty', driver_id = auth.uid(), odo = p_odo, energy_level = p_level where id = p_vehicle;
  return tid;
end $$;


-- (3) Xe: thêm "Ngưng hoạt động" (inactive) và "Đang sửa chữa tai nạn" (repair)
alter table public.vehicles drop constraint if exists vehicles_status_check;
alter table public.vehicles add constraint vehicles_status_check
  check (status in ('ready','on_duty','maintenance','inactive','repair'));

-- (4) Báo cáo tai nạn (không cần ca đang chạy)
create table if not exists public.accidents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  driver_id uuid not null references public.profiles(id),
  vehicle_id uuid references public.vehicles(id),
  trip_id uuid references public.trips(id),
  location text not null,
  description text not null,
  photos jsonb not null default '[]'::jsonb,   -- mảng đường dẫn ảnh trong Storage (tối đa 6)
  status text not null default 'new' check (status in ('new','handling','done')),
  manager_note text,
  check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 6)
);
alter table public.accidents enable row level security;
drop policy if exists "accidents: tài xế tạo báo cáo của mình" on public.accidents;
drop policy if exists "accidents: đọc của mình hoặc manager" on public.accidents;
drop policy if exists "accidents: manager cập nhật" on public.accidents;
create policy "accidents: tài xế tạo báo cáo của mình" on public.accidents for insert with check (
  driver_id = auth.uid() and status = 'new'
  and (trip_id is null or exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = auth.uid()))
);
create policy "accidents: đọc của mình hoặc manager" on public.accidents for select using (driver_id = auth.uid() or public.is_manager());
create policy "accidents: manager cập nhật" on public.accidents for update using (public.is_manager());

notify pgrst, 'reload schema';
