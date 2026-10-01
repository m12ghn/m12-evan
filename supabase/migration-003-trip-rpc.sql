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

-- Tài xế không còn tự sửa trực tiếp vehicles / trips
drop policy if exists "vehicles: tài xế nhận/trả xe" on public.vehicles;
drop policy if exists "trips: tài xế tạo ca của mình" on public.trips;
drop policy if exists "trips: tài xế sửa ca của mình" on public.trips;
create policy "trips: manager sửa ca" on public.trips for update using (public.is_manager());

-- Phiếu nhiên liệu/điện: chỉ tạo cho ca đang chạy của chính mình
drop policy if exists "refuels: tài xế tạo phiếu của mình" on public.refuels;
create policy "refuels: tài xế tạo phiếu của mình" on public.refuels for insert with check (
  driver_id = auth.uid() and status = 'pending'
  and exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = auth.uid() and t.status = 'on_duty')
);
