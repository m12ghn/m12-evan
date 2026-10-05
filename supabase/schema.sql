-- FleetOps schema. Chạy trong Supabase → SQL Editor.

-- 1. Hồ sơ người dùng + role -------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  license text,
  role text not null default 'driver' check (role in ('manager','driver')),
  active boolean not null default true,   -- Còn làm / Đã nghỉ
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
  if auth.uid() is not null and not public.is_manager() then
    if new.role is distinct from old.role then raise exception 'Không được đổi role'; end if;
    if new.active is distinct from old.active then raise exception 'Không được đổi trạng thái làm việc'; end if;
    if new.email is distinct from old.email then raise exception 'Không được đổi tên đăng nhập'; end if;
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
  status text not null default 'ready' check (status in ('ready','on_duty','maintenance','inactive','repair')),
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
  closed_by uuid references public.profiles(id),   -- có giá trị = ca do quản lý đóng thay tài xế
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
  total_amount numeric not null default 0,   -- xe điện nhập trực tiếp; xăng/dầu = số lượng × đơn giá
  battery_before int check (battery_before between 0 and 100),   -- xe điện: % pin trước khi sạc
  battery_after  int check (battery_after  between 0 and 100),   -- xe điện: % pin sau khi sạc
  charge_minutes int check (charge_minutes > 0),                 -- xe điện: thời gian sạc (phút)
  station text,             -- trạm xăng / trạm sạc
  photo_pump text,          -- ảnh cột bơm / màn hình trạm sạc
  photo_receipt text,
  photos jsonb,             -- {before, after, pump, receipt} = đường dẫn ảnh trong Storage
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  manager_note text
);

create or replace function public.refuel_total() returns trigger language plpgsql as $$
begin
  if new.total_amount is null or new.total_amount = 0 then
    new.total_amount := round(new.quantity * new.unit_price);
  end if;
  return new;
end $$;
create trigger refuel_total before insert on public.refuels for each row execute function public.refuel_total();

-- (4) Báo cáo tai nạn (không cần ca đang chạy)
create table public.accidents (
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
create policy "accidents: tài xế tạo báo cáo của mình" on public.accidents for insert with check (
  driver_id = (select auth.uid()) and status = 'new'
  and (trip_id is null or exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = (select auth.uid())))
);
create policy "accidents: đọc của mình hoặc manager" on public.accidents for select using (driver_id = (select auth.uid()) or (select public.is_manager()));
create policy "accidents: manager cập nhật" on public.accidents for update using ((select public.is_manager()));


-- 5. RLS -----------------------------------------------------------------------
alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table trips    enable row level security;
alter table refuels  enable row level security;

create policy "profiles: đọc của mình hoặc manager" on profiles for select
  using (id = (select auth.uid()) or (select public.is_manager()));
create policy "profiles: sửa của mình hoặc manager" on profiles for update
  using (id = (select auth.uid()) or (select public.is_manager()));
create policy "profiles: manager toàn quyền" on profiles for all using ((select public.is_manager()));

create policy "vehicles: ai đăng nhập cũng đọc" on vehicles for select using ((select auth.uid()) is not null);
create policy "vehicles: manager toàn quyền" on vehicles for all using ((select public.is_manager()));
-- Tài xế KHÔNG sửa trực tiếp vehicles/trips: nhận/trả xe qua hàm start_trip/end_trip (cuối file).

create policy "trips: đọc của mình hoặc manager" on trips for select
  using (driver_id = (select auth.uid()) or (select public.is_manager()));
create policy "trips: manager sửa ca" on trips for update using ((select public.is_manager()));

create policy "refuels: đọc của mình hoặc manager" on refuels for select
  using (driver_id = (select auth.uid()) or (select public.is_manager()));
create policy "refuels: tài xế tạo phiếu của mình" on refuels for insert with check (
  driver_id = (select auth.uid()) and status = 'pending'
  and exists (select 1 from trips t where t.id = trip_id and t.driver_id = (select auth.uid()) and t.status = 'on_duty')
);
create policy "refuels: manager duyệt" on refuels for update using ((select public.is_manager()));

-- 5b. Hàm nhận xe / trả xe
-- Nhận xe / trả xe chạy trọn gói trong DB (atomic + kiểm tra hợp lệ), thay cho việc tài xế tự sửa bảng vehicles/trips.

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


-- 5c. Nhật ký thao tác (audit log)
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,                 -- người thực hiện (null = hệ thống / SQL Editor)
  actor_name text,               -- tên tại thời điểm thao tác (giữ nguyên dù sau này đổi tên)
  action text not null,          -- insert | update | delete | login | logout | create_user | change_username | reset_password | set_active
  table_name text,               -- vehicles | trips | refuels | accidents | profiles | auth
  record_id text,
  row_data jsonb,                -- toàn bộ dòng sau khi thay đổi (hoặc dòng bị xóa)
  changes jsonb                  -- chỉ các cột đổi: {"cột": {"old": ..., "new": ...}}
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id);
create index if not exists audit_log_table_idx on public.audit_log (table_name);

alter table public.audit_log enable row level security;
drop policy if exists "audit_log: manager xem" on public.audit_log;
create policy "audit_log: manager xem" on public.audit_log for select using ((select public.is_manager()));
-- Không có policy insert/update/delete: chỉ trigger/hàm hệ thống mới ghi được, không ai sửa hay xóa được qua app.
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  nm text; old_j jsonb; new_j jsonb; chg jsonb; rid text; row_j jsonb;
begin
  if uid is null and claims->>'role' = 'service_role' then return coalesce(new, old); end if;

  select coalesce(full_name, email) into nm from profiles where id = uid;
  if tg_op = 'INSERT' then
    new_j := to_jsonb(new); row_j := new_j; rid := coalesce(new_j->>'id', new_j->>'key'); chg := null;
  elsif tg_op = 'UPDATE' then
    old_j := to_jsonb(old); new_j := to_jsonb(new); row_j := new_j; rid := coalesce(new_j->>'id', new_j->>'key');
    select jsonb_object_agg(k, jsonb_build_object('old', old_j->k, 'new', new_j->k)) into chg
      from jsonb_object_keys(new_j) k where old_j->k is distinct from new_j->k and k <> 'updated_at';
    if chg is null then return new; end if;
  else
    old_j := to_jsonb(old); row_j := old_j; rid := coalesce(old_j->>'id', old_j->>'key'); chg := null;
  end if;

  insert into audit_log (actor_id, actor_name, action, table_name, record_id, row_data, changes)
  values (uid, coalesce(nm, case when uid is null then 'Hệ thống / SQL Editor' end), lower(tg_op), tg_table_name, rid, row_j, chg);
  return coalesce(new, old);
end $$;
revoke all on function public.audit_row() from public;

do $$ declare t text; begin
  foreach t in array array['vehicles','trips','refuels','accidents','profiles'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
      execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
    end if;
  end loop;
end $$;

-- Ghi đăng nhập / đăng xuất từ app
create or replace function public.log_event(p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text;
begin
  if uid is null then return; end if;
  if p_action not in ('login', 'logout') then raise exception 'Hành động không hợp lệ'; end if;
  select coalesce(full_name, email) into nm from profiles where id = uid;
  insert into audit_log (actor_id, actor_name, action, table_name, record_id) values (uid, nm, p_action, 'auth', uid::text);
end $$;
revoke all on function public.log_event(text) from public;
grant execute on function public.log_event(text) to authenticated;


-- 5e. Telegram
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "app_settings: manager toàn quyền" on public.app_settings;
create policy "app_settings: manager toàn quyền" on public.app_settings for all
  using ((select public.is_manager())) with check ((select public.is_manager()));

-- Nhật ký các tin đã gửi (để không gửi trùng, và để gửi lại khi lỗi)
create table if not exists public.telegram_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  event text not null,            -- checkin | refuel | checkout | test
  ref_id text,                    -- id ca / phiếu
  chat_id text,
  status text not null check (status in ('pending','sent','failed','skipped')),
  error text,
  message_id bigint
);
create unique index if not exists telegram_log_once_idx on public.telegram_log (event, ref_id) where status in ('sent','pending');
create index if not exists telegram_log_at_idx on public.telegram_log (at desc);
alter table public.telegram_log enable row level security;
drop policy if exists "telegram_log: manager xem" on public.telegram_log;
create policy "telegram_log: manager xem" on public.telegram_log for select using ((select public.is_manager()));
revoke all on public.telegram_log from anon, authenticated;
grant select on public.telegram_log to authenticated;

create trigger audit_app_settings after insert or update or delete on public.app_settings
  for each row execute function public.audit_row();

-- 5f. Telegram tự động (trigger + pg_net)
do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'Chưa bật được pg_net (%).', sqlerrm;
end $$;

-- Cấu hình RIÊNG TƯ (địa chỉ + mã bí mật). Không ai đọc được qua app; chỉ hàm hệ thống đọc.
create table if not exists public.private_config (
  key text primary key,
  value text not null
);
alter table public.private_config enable row level security;
revoke all on public.private_config from anon, authenticated;

-- Quản lý lưu địa chỉ + mã bí mật từ trang Cài đặt (mã không bao giờ được trả ngược về trình duyệt)
create or replace function public.set_telegram_hook(p_url text, p_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_manager() then raise exception 'Chỉ quản lý mới có quyền này'; end if;
  if p_url is null or p_url !~ '^https://[^ ]+$' then raise exception 'Địa chỉ phải bắt đầu bằng https://'; end if;
  if p_secret is null or length(p_secret) < 16 then raise exception 'Mã bí mật tối thiểu 16 ký tự'; end if;
  insert into private_config (key, value) values ('hook_url', p_url), ('hook_secret', p_secret)
    on conflict (key) do update set value = excluded.value;
end $$;

create or replace function public.telegram_hook_status() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u text; s text; net_ok boolean;
begin
  if auth.uid() is not null and not public.is_manager() then raise exception 'Chỉ quản lý mới có quyền này'; end if;
  select value into u from private_config where key = 'hook_url';
  select value into s from private_config where key = 'hook_secret';
  net_ok := to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null;
  return jsonb_build_object('configured', u is not null and s is not null, 'url', u, 'pg_net', net_ok,
    'cron', to_regclass('cron.job') is not null);
end $$;

revoke all on function public.set_telegram_hook(text, text) from public;
revoke all on function public.telegram_hook_status() from public;
grant execute on function public.set_telegram_hook(text, text) to authenticated;
grant execute on function public.telegram_hook_status() to authenticated;

-- Trigger: vào ca (thêm ca) · kết thúc ca (ca chuyển sang completed) · sạc điện/đổ nhiên liệu (thêm phiếu)
create or replace function public.notify_telegram() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev text; u text; s text;
begin
  if tg_table_name = 'trips' and tg_op = 'INSERT' then ev := 'checkin';
  elsif tg_table_name = 'trips' and tg_op = 'UPDATE' and old.status = 'on_duty' and new.status = 'completed' then ev := 'checkout';
  elsif tg_table_name = 'refuels' and tg_op = 'INSERT' then ev := 'refuel';
  else return new; end if;

  select value into u from private_config where key = 'hook_url';
  select value into s from private_config where key = 'hook_secret';
  if u is null or s is null then return new; end if;

  begin
    -- pg_net gửi bất đồng bộ SAU KHI giao dịch được lưu; lỗi ở đây không bao giờ làm hỏng thao tác của tài xế
    perform net.http_post(
      url := u,
      body := jsonb_build_object('event', ev, 'id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || s),
      timeout_milliseconds := 40000
    );
  exception when others then
    null;
  end;
  return new;
end $$;
revoke all on function public.notify_telegram() from public;

drop trigger if exists telegram_trips on public.trips;
create trigger telegram_trips after insert or update on public.trips
  for each row execute function public.notify_telegram();
drop trigger if exists telegram_refuels on public.refuels;
create trigger telegram_refuels after insert on public.refuels
  for each row execute function public.notify_telegram();

-- Quét bù: mỗi 5 phút gửi các sự kiện (48 giờ gần nhất) chưa gửi được
create or replace function public.telegram_cron_sweep() returns void
language plpgsql security definer set search_path = public as $$
declare u text; s text;
begin
  select value into u from private_config where key = 'hook_url';
  select value into s from private_config where key = 'hook_secret';
  if u is null or s is null then return; end if;
  perform net.http_post(
    url := u, body := jsonb_build_object('action', 'sweep'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || s),
    timeout_milliseconds := 40000
  );
end $$;
revoke all on function public.telegram_cron_sweep() from public;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('telegram-sweep', '*/5 * * * *', 'select public.telegram_cron_sweep()');
exception when others then
  raise notice 'Chưa đặt được lịch quét bù (%). Bật pg_cron tại Database → Extensions rồi chạy lại phần này. Tin vẫn được gửi ngay nhờ trigger.', sqlerrm;
end $$;


-- 5g. Quản lý đóng ca thay tài xế
create or replace function public.manager_close_trip(
  p_trip uuid, p_end_odo int, p_end_level int, p_vehicle_status text, p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
declare t public.trips; v public.vehicles; filled numeric; km int; consumed numeric; uid uuid := auth.uid();
begin
  if uid is not null and not public.is_manager() then raise exception 'Chỉ quản lý mới có quyền này'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Cần nhập lý do đóng ca'; end if;

  select * into t from trips where id = p_trip and status = 'on_duty' for update;
  if not found then raise exception 'Không tìm thấy ca đang chạy (có thể tài xế đã tự trả xe)'; end if;
  if p_end_odo is null or p_end_odo < t.start_odo then raise exception 'ODO cuối ca không được nhỏ hơn ODO đầu ca (% km)', t.start_odo; end if;
  if p_end_level is null or p_end_level < 0 or p_end_level > 100 then raise exception 'Mức nhiên liệu/pin phải từ 0–100'; end if;
  if p_vehicle_status is null or p_vehicle_status not in ('ready', 'maintenance', 'repair', 'inactive') then
    raise exception 'Trạng thái xe sau ca không hợp lệ';
  end if;

  select * into v from vehicles where id = t.vehicle_id for update;
  select coalesce(sum(quantity), 0) into filled from refuels where trip_id = t.id and status <> 'rejected';
  km := p_end_odo - t.start_odo;
  consumed := greatest(0, ((t.start_level - p_end_level) / 100.0) * v.capacity + filled);

  update trips set status = 'completed', end_time = now(), end_odo = p_end_odo, end_level = p_end_level,
    km_driven = km, energy_consumed = round(consumed, 1),
    energy_rate = case when km > 0 then round(consumed / km * 100, 1) else 0 end,
    post_notes = 'Quản lý đóng ca: ' || trim(p_reason), closed_by = uid
  where id = t.id;

  update vehicles set status = p_vehicle_status, driver_id = null, odo = p_end_odo, energy_level = p_end_level
  where id = t.vehicle_id;
end $$;

revoke all on function public.manager_close_trip(uuid, int, int, text, text) from public;
grant execute on function public.manager_close_trip(uuid, int, int, text, text) to authenticated;


-- 5d. Chỉ mục
-- Chỉ mục cho các truy vấn thường dùng (danh sách ca/phiếu/tai nạn, tra cứu theo tài xế/xe/trạng thái)
create index if not exists trips_driver_status_idx on public.trips (driver_id, status);
create index if not exists trips_vehicle_idx on public.trips (vehicle_id);
create index if not exists trips_start_time_idx on public.trips (start_time desc);
create index if not exists refuels_trip_idx on public.refuels (trip_id);
create index if not exists refuels_status_idx on public.refuels (status, created_at desc);
create index if not exists refuels_driver_idx on public.refuels (driver_id);
create index if not exists accidents_status_idx on public.accidents (status, created_at desc);
create index if not exists accidents_driver_idx on public.accidents (driver_id);
create index if not exists vehicles_status_idx on public.vehicles (status);

-- 6. Storage ảnh (taplo, 4 góc xe, cột bơm, hóa đơn) -------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
  on conflict do nothing;

create policy "photos: đăng nhập được upload vào thư mục của mình" on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: đọc ảnh của mình hoặc manager" on storage.objects for select
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_manager())));
