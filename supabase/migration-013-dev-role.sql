-- Migration 013: thêm role "dev" (quyền cao nhất). Chạy được nhiều lần.
-- dev = mọi quyền của quản lý + cấu hình Telegram/bí mật/nhật ký cập nhật app. Quản lý (manager) không thấy các mục đó.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('manager','driver','dev'));

-- dev cũng là quản lý (mọi chính sách RLS dùng is_manager() tự áp dụng cho dev)
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('manager','dev'));
$$;
create or replace function public.is_dev() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'dev');
$$;

-- Chỉ dev được cấp quyền dev hoặc sửa tài khoản dev khác
create or replace function public.protect_role() returns trigger
language plpgsql as $$
begin
  -- auth.uid() null = chạy từ SQL Editor / service role (quản trị hệ thống) → cho phép
  if auth.uid() is not null and not public.is_dev() then
    if new.role = 'dev' and old.role is distinct from 'dev' then raise exception 'Chỉ dev mới được cấp quyền dev'; end if;
    if old.role = 'dev' and old.id <> auth.uid() then raise exception 'Không được sửa tài khoản dev'; end if;
  end if;
  if auth.uid() is not null and not public.is_manager() then
    if new.role is distinct from old.role then raise exception 'Không được đổi role'; end if;
    if new.active is distinct from old.active then raise exception 'Không được đổi trạng thái làm việc'; end if;
    if new.email is distinct from old.email then raise exception 'Không được đổi tên đăng nhập'; end if;
  end if;
  return new;
end $$;

-- Cấu hình Telegram + nhật ký gửi: chỉ dev
drop policy if exists "app_settings: manager toàn quyền" on public.app_settings;
drop policy if exists "app_settings: dev toàn quyền" on public.app_settings;
create policy "app_settings: dev toàn quyền" on public.app_settings for all
  using ((select public.is_dev())) with check ((select public.is_dev()));

drop policy if exists "telegram_log: manager xem" on public.telegram_log;
drop policy if exists "telegram_log: dev xem" on public.telegram_log;
create policy "telegram_log: dev xem" on public.telegram_log for select using ((select public.is_dev()));

-- Nhật ký thao tác: quản lý không thấy các thay đổi cấu hình app (app_settings)
drop policy if exists "audit_log: manager xem" on public.audit_log;
create policy "audit_log: manager xem" on public.audit_log for select
  using ((select public.is_dev()) or ((select public.is_manager()) and table_name <> 'app_settings'));

create or replace function public.set_telegram_hook(p_url text, p_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_dev() then raise exception 'Chỉ dev mới có quyền này'; end if;
  if p_url is null or p_url !~ '^https://[^ ]+$' then raise exception 'Địa chỉ phải bắt đầu bằng https://'; end if;
  if p_secret is null or length(p_secret) < 16 then raise exception 'Mã bí mật tối thiểu 16 ký tự'; end if;
  insert into private_config (key, value) values ('hook_url', p_url), ('hook_secret', p_secret)
    on conflict (key) do update set value = excluded.value;
end $$;

create or replace function public.telegram_hook_status() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u text; s text; net_ok boolean;
begin
  if auth.uid() is not null and not public.is_dev() then raise exception 'Chỉ dev mới có quyền này'; end if;
  select value into u from private_config where key = 'hook_url';
  select value into s from private_config where key = 'hook_secret';
  net_ok := to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null;
  return jsonb_build_object('configured', u is not null and s is not null, 'url', u, 'pg_net', net_ok,
    'cron', to_regclass('cron.job') is not null);
end $$;

-- Nâng một tài khoản đã có lên dev (thay 'dev' bằng tên đăng nhập; bỏ comment để chạy):
-- update public.profiles set role = 'dev' where email = 'dev@fleetops.local';

notify pgrst, 'reload schema';
