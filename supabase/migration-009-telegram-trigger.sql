-- Migration 009: database tự gửi tin Telegram ngay khi có dữ liệu mới (trigger + pg_net), và tự quét bù mỗi 5 phút (pg_cron).
-- Chạy được nhiều lần. Cần bật extension pg_net (và pg_cron cho phần quét bù) trong Supabase → Database → Extensions.

do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'Chưa bật được pg_net (%). Bật tại Supabase → Database → Extensions → pg_net rồi chạy lại.', sqlerrm;
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

notify pgrst, 'reload schema';
