-- Migration 008: gửi tin Telegram (cấu hình + nhật ký gửi). Chạy được nhiều lần.

-- Cài đặt chung của app (vd. mã chat Telegram). KHÔNG lưu token bot ở đây — token nằm ở biến môi trường Vercel.
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
  status text not null check (status in ('pending','sent','failed')),
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

-- Nhật ký thao tác cũng ghi lại việc đổi cài đặt (bảng này dùng cột key thay vì id)
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
drop trigger if exists audit_app_settings on public.app_settings;
create trigger audit_app_settings after insert or update or delete on public.app_settings
  for each row execute function public.audit_row();

notify pgrst, 'reload schema';
