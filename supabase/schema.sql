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
-- Tài xế cập nhật xe khi nhận/trả xe. TODO: siết chặt bằng RPC (security definer) khi port logic check-in/out.
create policy "vehicles: tài xế nhận/trả xe" on vehicles for update
  using (status = 'ready' or driver_id = auth.uid());

create policy "trips: đọc của mình hoặc manager" on trips for select
  using (driver_id = auth.uid() or is_manager());
create policy "trips: tài xế tạo ca của mình" on trips for insert with check (driver_id = auth.uid());
create policy "trips: tài xế sửa ca của mình" on trips for update using (driver_id = auth.uid() or is_manager());

create policy "refuels: đọc của mình hoặc manager" on refuels for select
  using (driver_id = auth.uid() or is_manager());
create policy "refuels: tài xế tạo phiếu của mình" on refuels for insert
  with check (driver_id = auth.uid() and status = 'pending');
create policy "refuels: manager duyệt" on refuels for update using (is_manager());

-- 6. Storage ảnh (taplo, 4 góc xe, cột bơm, hóa đơn) -------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
  on conflict do nothing;

create policy "photos: đăng nhập được upload vào thư mục của mình" on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: đọc ảnh của mình hoặc manager" on storage.objects for select
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_manager()));
