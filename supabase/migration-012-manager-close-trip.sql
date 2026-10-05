-- Migration 012: quản lý đóng ca thay tài xế (vd. tài xế quên trả xe). Chạy được nhiều lần.

-- Đánh dấu ca do quản lý đóng (để báo cáo phân biệt với ca tài xế tự trả xe)
alter table public.trips add column if not exists closed_by uuid references public.profiles(id);

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

notify pgrst, 'reload schema';
