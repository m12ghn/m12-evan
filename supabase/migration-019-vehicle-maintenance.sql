-- Migration 019: nhật ký bảo trì / bảo dưỡng / sửa chữa xe. Chạy được nhiều lần.
-- Trước đây app CHỈ lưu "trạng thái hiện tại" của xe (Bảo dưỡng, Đang sửa chữa tai nạn…) và các lần đổi trạng thái nằm lẫn trong nhật ký thao tác.
-- Bảng này là nhật ký riêng: (1) quản lý ghi tay nội dung bảo trì (ngày, ODO, nơi thực hiện, chi phí, ảnh), (2) tự ghi mỗi lần xe vào/ra trạng thái Bảo dưỡng / Sửa chữa,
-- (3) nhập lại các lần đổi trạng thái đã có trong Nhật ký thao tác (audit_log) để có lịch sử ngay.

create table if not exists public.vehicle_maintenance (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  at timestamptz not null default now(),                       -- thời điểm ghi nhật ký
  source text not null default 'manual' check (source in ('manual','auto','audit')),   -- manual: quản lý ghi; auto: tự ghi khi đổi trạng thái; audit: nhập từ nhật ký thao tác cũ
  kind text not null default 'service' check (kind in ('service','repair','accident_repair','inspection','other','status')),
  status_from text,                                            -- trạng thái xe trước / sau (khi có đổi)
  status_to text,
  description text,                                            -- nội dung bảo trì / sửa chữa
  performed_on date,                                           -- ngày thực hiện
  odo integer,
  garage text,                                                 -- nơi thực hiện (garage, xưởng)
  cost numeric not null default 0 check (cost >= 0),           -- chi phí (đ)
  photos jsonb not null default '[]'::jsonb,                   -- đường dẫn ảnh trong Storage (tối đa 6)
  accident_id uuid references public.accidents(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 6),
  check (kind <> 'status' or status_to is not null)
);
create index if not exists vehicle_maintenance_vehicle_idx on public.vehicle_maintenance (vehicle_id, at desc);
create index if not exists vehicle_maintenance_at_idx on public.vehicle_maintenance (at desc);
create unique index if not exists vehicle_maintenance_audit_uq on public.vehicle_maintenance (vehicle_id, at) where source = 'audit';

alter table public.vehicle_maintenance enable row level security;
drop policy if exists "vehicle_maintenance: manager xem" on public.vehicle_maintenance;
create policy "vehicle_maintenance: manager xem" on public.vehicle_maintenance for select using ((select public.is_manager()));
-- Không có policy insert/update/delete: chỉ ghi qua add_maintenance_log() hoặc trigger; dòng đã ghi không sửa/xóa được qua app.
revoke all on public.vehicle_maintenance from anon, authenticated;
grant select on public.vehicle_maintenance to authenticated;

-- Tự ghi mỗi lần xe VÀO hoặc RA khỏi trạng thái Bảo dưỡng / Đang sửa chữa tai nạn (kể cả do tài xế báo hư hỏng cuối ca, quản lý đóng ca, sửa ở Cài đặt)
create or replace function public.log_vehicle_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text;
begin
  if coalesce(current_setting('app.skip_status_log', true), '') = '1' then return new; end if;   -- add_maintenance_log() đã tự ghi
  if new.status is distinct from old.status and (new.status in ('maintenance','repair') or old.status in ('maintenance','repair')) then
    select coalesce(full_name, email) into nm from profiles where id = uid;
    insert into vehicle_maintenance (vehicle_id, source, kind, status_from, status_to, odo, created_by, created_by_name)
    values (new.id, 'auto', 'status', old.status, new.status, new.odo, uid, coalesce(nm, case when uid is null then 'Hệ thống / SQL Editor' end));
  end if;
  return new;
end $$;
drop trigger if exists vehicle_status_log on public.vehicles;
create trigger vehicle_status_log after update of status on public.vehicles
  for each row execute function public.log_vehicle_status();

-- Quản lý ghi một lần bảo trì / sửa chữa (tùy chọn đổi luôn trạng thái xe)
create or replace function public.add_maintenance_log(
  p_vehicle uuid, p_kind text, p_description text, p_performed_on date, p_odo int,
  p_garage text, p_cost numeric, p_photos jsonb, p_accident uuid, p_vehicle_status text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v public.vehicles; nid uuid; nm text; ph jsonb := coalesce(p_photos, '[]'::jsonb); st text;
begin
  if uid is null or not public.is_manager() then raise exception 'Chỉ quản lý mới có quyền này'; end if;
  if p_kind not in ('service','repair','accident_repair','inspection','other') then raise exception 'Loại bảo trì không hợp lệ'; end if;
  if coalesce(trim(p_description), '') = '' then raise exception 'Nhập nội dung bảo trì / sửa chữa'; end if;
  if p_cost is not null and p_cost < 0 then raise exception 'Chi phí không hợp lệ'; end if;
  if p_odo is not null and p_odo < 0 then raise exception 'ODO không hợp lệ'; end if;
  select * into v from vehicles where id = p_vehicle for update;
  if not found then raise exception 'Không tìm thấy xe'; end if;
  if p_vehicle_status is not null then
    if p_vehicle_status not in ('ready','maintenance','repair','inactive') then raise exception 'Trạng thái xe không hợp lệ'; end if;
    if v.status = 'on_duty' then raise exception 'Xe đang vận hành (có ca chưa trả xe), chưa đổi trạng thái được'; end if;
    if p_vehicle_status <> v.status then st := p_vehicle_status; end if;
  end if;
  select coalesce(full_name, email) into nm from profiles where id = uid;
  insert into vehicle_maintenance (vehicle_id, source, kind, status_from, status_to, description, performed_on, odo, garage, cost, photos, accident_id, created_by, created_by_name)
  values (p_vehicle, 'manual', p_kind, case when st is not null then v.status end, st, trim(p_description), coalesce(p_performed_on, current_date),
          coalesce(p_odo, v.odo), nullif(trim(coalesce(p_garage, '')), ''), coalesce(p_cost, 0), ph, p_accident, uid, nm)
  returning id into nid;
  if st is not null then
    perform set_config('app.skip_status_log', '1', true);
    update vehicles set status = st where id = p_vehicle;
    perform set_config('app.skip_status_log', '', true);
  end if;
  return nid;
end $$;
revoke all on function public.add_maintenance_log(uuid, text, text, date, int, text, numeric, jsonb, uuid, text) from public;
grant execute on function public.add_maintenance_log(uuid, text, text, date, int, text, numeric, jsonb, uuid, text) to authenticated;

-- Nhập lịch sử đã có: các lần đổi trạng thái liên quan Bảo dưỡng / Sửa chữa trong Nhật ký thao tác (chạy lại không bị trùng)
insert into public.vehicle_maintenance (vehicle_id, at, source, kind, status_from, status_to, odo, created_by, created_by_name)
select v.id, a.at, 'audit', 'status', a.changes->'status'->>'old', a.changes->'status'->>'new',
       case when (a.row_data->>'odo') ~ '^\d+$' then (a.row_data->>'odo')::int end, p.id, a.actor_name
from public.audit_log a
join public.vehicles v on v.id::text = a.record_id
left join public.profiles p on p.id = a.actor_id
where a.table_name = 'vehicles' and a.action = 'update' and a.changes ? 'status'
  and (a.changes->'status'->>'new' in ('maintenance','repair') or a.changes->'status'->>'old' in ('maintenance','repair'))
  and a.changes->'status'->>'new' is not null
on conflict (vehicle_id, at) where source = 'audit' do nothing;

notify pgrst, 'reload schema';
