-- Migration 011: tăng thời gian chờ pg_net lên 40 giây (gửi tin kèm ảnh có thể mất hơn 5 giây). Chạy được nhiều lần.

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

notify pgrst, 'reload schema';
