-- SETUP MỘT LẦN: schema + xe mẫu + 2 tài khoản test. Dán toàn bộ vào Supabase → SQL Editor → Run.
-- CẢNH BÁO: script xóa & tạo lại các bảng của app (profiles, vehicles, trips, refuels) nên chỉ dùng khi mới cài đặt.
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.refuels cascade;
drop table if exists public.trips cascade;
drop table if exists public.vehicles cascade;
drop table if exists public.profiles cascade;
drop policy if exists "photos: đăng nhập được upload vào thư mục của mình" on storage.objects;
drop policy if exists "photos: đọc ảnh của mình hoặc manager" on storage.objects;

-- FleetOps schema. Chạy trong Supabase → SQL Editor.

-- 1. Hồ sơ người dùng + role -------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  license text,
  role text not null default 'driver' check (role in ('manager','driver')),
  created_at timestamptz not null default now()
);

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'manager');
$$;

-- Tự tạo profile (role=driver) khi có user mới. Nâng quyền manager thủ công (xem README).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email) values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Chặn user tự đổi role của mình
create or replace function public.protect_role() returns trigger
language plpgsql as $$
begin
  -- auth.uid() null = chạy từ SQL Editor / service role (quản trị hệ thống) → cho phép
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_manager() then
    raise exception 'Không được đổi role';
  end if;
  return new;
end $$;
create trigger protect_role before update on public.profiles
  for each row execute function public.protect_role();

-- 2. Xe -----------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text unique not null,
  type text,
  energy_type text not null default 'fuel' check (energy_type in ('fuel','electric')),
  capacity numeric not null default 70,           -- dung tích bình (lít) hoặc pin (kWh)
  std_rate numeric not null default 11,           -- định mức L/100km hoặc kWh/100km
  fuel_type text not null default 'Dầu Diesel (DO)',  -- loại nhiên liệu; xe điện: 'Điện'
  odo integer not null default 0,
  energy_level integer not null default 50 check (energy_level between 0 and 100),  -- % bình / % pin
  status text not null default 'ready' check (status in ('ready','on_duty','maintenance')),
  driver_id uuid references public.profiles(id)
);

-- 3. Ca vận hành ---------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  driver_id uuid not null references public.profiles(id),
  status text not null default 'on_duty' check (status in ('on_duty','completed')),
  start_time timestamptz not null default now(),
  end_time timestamptz,
  start_odo integer not null,
  end_odo integer,
  start_level integer not null,
  end_level integer,
  km_driven integer,
  energy_consumed numeric,
  energy_rate numeric,   -- L/100km hoặc kWh/100km
  pre_notes text,
  post_notes text,
  has_damage boolean not null default false,
  damage_notes text,
  photos_start jsonb,   -- {taplo, front, back, left, right} = đường dẫn trong Storage
  photos_end jsonb,
  check (end_odo is null or end_odo >= start_odo)
);

-- 4. Phiếu cấp nhiên liệu / cấp điện (một bảng chung) -----------------------------------------------------------
create table public.refuels (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  driver_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  energy_type text not null default 'fuel',
  fuel_type text,
  odo_at_refuel integer not null,
  quantity numeric not null check (quantity > 0),   -- lít hoặc kWh
  unit_price numeric not null default 0,            -- đ/lít hoặc đ/kWh
  total_amount numeric generated always as (quantity * unit_price) stored,
  station text,             -- trạm xăng / trạm sạc
  photo_pump text,          -- ảnh cột bơm / màn hình trạm sạc
  photo_receipt text,
  photos jsonb,             -- {before, after, pump, receipt} = đường dẫn ảnh trong Storage
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  manager_note text
);

-- 5. RLS -----------------------------------------------------------------------
alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table trips    enable row level security;
alter table refuels  enable row level security;

create policy "profiles: đọc của mình hoặc manager" on profiles for select
  using (id = auth.uid() or is_manager());
create policy "profiles: sửa của mình hoặc manager" on profiles for update
  using (id = auth.uid() or is_manager());
create policy "profiles: manager toàn quyền" on profiles for all using (is_manager());

create policy "vehicles: ai đăng nhập cũng đọc" on vehicles for select using (auth.uid() is not null);
create policy "vehicles: manager toàn quyền" on vehicles for all using (is_manager());
-- Tài xế KHÔNG sửa trực tiếp vehicles/trips: nhận/trả xe qua hàm start_trip/end_trip (cuối file).

create policy "trips: đọc của mình hoặc manager" on trips for select
  using (driver_id = auth.uid() or is_manager());
create policy "trips: manager sửa ca" on trips for update using (is_manager());

create policy "refuels: đọc của mình hoặc manager" on refuels for select
  using (driver_id = auth.uid() or is_manager());
create policy "refuels: tài xế tạo phiếu của mình" on refuels for insert with check (
  driver_id = auth.uid() and status = 'pending'
  and exists (select 1 from trips t where t.id = trip_id and t.driver_id = auth.uid() and t.status = 'on_duty')
);
create policy "refuels: manager duyệt" on refuels for update using (is_manager());

-- 5b. Hàm nhận xe / trả xe
-- Nhận xe / trả xe chạy trọn gói trong DB (atomic + kiểm tra hợp lệ), thay cho việc tài xế tự sửa bảng vehicles/trips.

create or replace function public.start_trip(
  p_vehicle uuid, p_odo int, p_level int, p_notes text, p_photos jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v public.vehicles; tid uuid;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
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

create or replace function public.end_trip(
  p_trip uuid, p_end_odo int, p_end_level int, p_damage boolean, p_damage_notes text, p_photos jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare t public.trips; v public.vehicles; filled numeric; km int; consumed numeric;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select * into t from trips where id = p_trip and driver_id = auth.uid() and status = 'on_duty' for update;
  if not found then raise exception 'Không tìm thấy ca đang chạy của bạn'; end if;
  if p_end_odo is null or p_end_odo < t.start_odo then raise exception 'ODO cuối ca không được nhỏ hơn ODO đầu ca'; end if;
  if p_end_level is null or p_end_level < 0 or p_end_level > 100 then raise exception 'Mức nhiên liệu/pin phải từ 0–100'; end if;
  if p_damage and coalesce(trim(p_damage_notes), '') = '' then raise exception 'Cần mô tả sự cố'; end if;

  select * into v from vehicles where id = t.vehicle_id for update;
  select coalesce(sum(quantity), 0) into filled from refuels where trip_id = t.id and status <> 'rejected';
  km := p_end_odo - t.start_odo;
  -- Tiêu hao = (% đầu − % cuối) × dung tích + lượng đã cấp trong ca
  consumed := greatest(0, ((t.start_level - p_end_level) / 100.0) * v.capacity + filled);

  update trips set status = 'completed', end_time = now(), end_odo = p_end_odo, end_level = p_end_level,
    km_driven = km, energy_consumed = round(consumed, 1),
    energy_rate = case when km > 0 then round(consumed / km * 100, 1) else 0 end,
    has_damage = coalesce(p_damage, false), damage_notes = case when p_damage then p_damage_notes end,
    photos_end = p_photos
  where id = t.id;

  update vehicles set status = case when p_damage then 'maintenance' else 'ready' end,
    driver_id = null, odo = p_end_odo, energy_level = p_end_level
  where id = t.vehicle_id;
end $$;

revoke all on function public.start_trip(uuid,int,int,text,jsonb) from public;
revoke all on function public.end_trip(uuid,int,int,boolean,text,jsonb) from public;
grant execute on function public.start_trip(uuid,int,int,text,jsonb) to authenticated;
grant execute on function public.end_trip(uuid,int,int,boolean,text,jsonb) to authenticated;


-- 6. Storage ảnh (taplo, 4 góc xe, cột bơm, hóa đơn) -------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
  on conflict do nothing;

create policy "photos: đăng nhập được upload vào thư mục của mình" on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: đọc ảnh của mình hoặc manager" on storage.objects for select
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_manager()));

-- Dữ liệu mẫu (trích từ prototype). Chạy sau schema.sql.
insert into vehicles (plate, type, energy_type, capacity, std_rate, fuel_type, odo, energy_level, status) values
 ('29H-102.34','Tải 1.5 Tấn - Kia K250','fuel',60,10.5,'Dầu Diesel (DO)',45200,75,'ready'),
 ('29C-543.21','Tải 2.4 Tấn - Isuzu QKR','fuel',75,11.8,'Dầu Diesel (DO)',68150,60,'ready'),
 ('51D-891.22','Tải 1.9 Tấn - Hyundai Mighty','fuel',70,11.2,'Dầu Diesel (DO)',52400,85,'ready'),
 ('60C-321.45','Tải 3.5 Tấn - Hino 300','fuel',100,13.5,'Dầu Diesel (DO)',91200,45,'ready'),
 ('50H-123.90','Tải 1.4 Tấn - Suzuki Pro','fuel',45,7.5,'Xăng RON 95',21300,80,'ready'),
 ('51K-888.99','Xe điện VinFast EC Van','electric',17,14,'Điện',3200,90,'ready');
-- Danh sách đầy đủ 22 xe: xem prototype/app.js (INITIAL_VEHICLES)

-- TÀI KHOẢN TEST — chạy trong Supabase → SQL Editor SAU KHI đã chạy schema.sql.
-- Đăng nhập trên app:
--   Admin : admin@fleetops.local   / Admin@12345
--   Tài xế: 10001 (MSNV)           / Driver@12345
-- XÓA hoặc đổi mật khẩu trước khi dùng thật.

do $$
declare
  u record;
  uid uuid;
begin
  for u in select * from (values
    ('admin@fleetops.local',  'Admin@12345',  'Admin Test',  'manager'),
    ('10001@fleetops.local',  'Driver@12345', 'Tài Xế Test', 'driver')
  ) as t(email, pw, full_name, role)
  loop
    select id into uid from auth.users where email = u.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', u.email,
        crypt(u.pw, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name),
        now(), now(), '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', u.email, 'email_verified', true),
        'email', now(), now(), now());
    end if;
    -- profile được trigger tạo tự động (role=driver); đặt lại role đúng
    update public.profiles set role = u.role, full_name = u.full_name where id = uid;
  end loop;
end $$;

select p.role, p.full_name, u.email from public.profiles p join auth.users u on u.id = p.id
where u.email in ('admin@fleetops.local', '10001@fleetops.local');
