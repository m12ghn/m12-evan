-- Migration 006: Nhật ký thao tác (audit log). Ghi tự động mọi thêm/sửa/xóa + đăng nhập/đăng xuất. Chạy được nhiều lần.

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
create policy "audit_log: manager xem" on public.audit_log for select using (public.is_manager());
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
  -- Thao tác của máy chủ qua khóa service_role (hàm /api/admin-users) tự ghi nhật ký riêng, tránh ghi trùng
  if uid is null and claims->>'role' = 'service_role' then return coalesce(new, old); end if;

  select coalesce(full_name, email) into nm from profiles where id = uid;
  if tg_op = 'INSERT' then
    new_j := to_jsonb(new); row_j := new_j; rid := new_j->>'id'; chg := null;
  elsif tg_op = 'UPDATE' then
    old_j := to_jsonb(old); new_j := to_jsonb(new); row_j := new_j; rid := new_j->>'id';
    select jsonb_object_agg(k, jsonb_build_object('old', old_j->k, 'new', new_j->k)) into chg
      from jsonb_object_keys(new_j) k where old_j->k is distinct from new_j->k;
    if chg is null then return new; end if;  -- không có gì thay đổi
  else
    old_j := to_jsonb(old); row_j := old_j; rid := old_j->>'id'; chg := null;
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

notify pgrst, 'reload schema';
