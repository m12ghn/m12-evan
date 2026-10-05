-- Migration 007: tối ưu hiệu năng + vá bảo mật. Chạy được nhiều lần.
-- (a) chỉ mục, (b) người dùng không tự đổi role/trạng thái làm việc/tên đăng nhập, (c) viết lại chính sách RLS theo khuyến nghị hiệu năng của Supabase.

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

drop policy if exists "accidents: tài xế tạo báo cáo của mình" on public.accidents;
create policy "accidents: tài xế tạo báo cáo của mình" on public.accidents for insert with check (
  driver_id = (select auth.uid()) and status = 'new'
  and (trip_id is null or exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = (select auth.uid())))
);

drop policy if exists "accidents: đọc của mình hoặc manager" on public.accidents;
create policy "accidents: đọc của mình hoặc manager" on public.accidents for select using (driver_id = (select auth.uid()) or (select public.is_manager()));

drop policy if exists "accidents: manager cập nhật" on public.accidents;
create policy "accidents: manager cập nhật" on public.accidents for update using ((select public.is_manager()));

drop policy if exists "profiles: đọc của mình hoặc manager" on profiles;
create policy "profiles: đọc của mình hoặc manager" on profiles for select
  using (id = (select auth.uid()) or (select public.is_manager()));

drop policy if exists "profiles: sửa của mình hoặc manager" on profiles;
create policy "profiles: sửa của mình hoặc manager" on profiles for update
  using (id = (select auth.uid()) or (select public.is_manager()));

drop policy if exists "profiles: manager toàn quyền" on profiles;
create policy "profiles: manager toàn quyền" on profiles for all using ((select public.is_manager()));

drop policy if exists "vehicles: ai đăng nhập cũng đọc" on vehicles;
create policy "vehicles: ai đăng nhập cũng đọc" on vehicles for select using ((select auth.uid()) is not null);

drop policy if exists "vehicles: manager toàn quyền" on vehicles;
create policy "vehicles: manager toàn quyền" on vehicles for all using ((select public.is_manager()));

drop policy if exists "trips: đọc của mình hoặc manager" on trips;
create policy "trips: đọc của mình hoặc manager" on trips for select
  using (driver_id = (select auth.uid()) or (select public.is_manager()));

drop policy if exists "trips: manager sửa ca" on trips;
create policy "trips: manager sửa ca" on trips for update using ((select public.is_manager()));

drop policy if exists "refuels: đọc của mình hoặc manager" on refuels;
create policy "refuels: đọc của mình hoặc manager" on refuels for select
  using (driver_id = (select auth.uid()) or (select public.is_manager()));

drop policy if exists "refuels: tài xế tạo phiếu của mình" on refuels;
create policy "refuels: tài xế tạo phiếu của mình" on refuels for insert with check (
  driver_id = (select auth.uid()) and status = 'pending'
  and exists (select 1 from trips t where t.id = trip_id and t.driver_id = (select auth.uid()) and t.status = 'on_duty')
);

drop policy if exists "refuels: manager duyệt" on refuels;
create policy "refuels: manager duyệt" on refuels for update using ((select public.is_manager()));

drop policy if exists "audit_log: manager xem" on public.audit_log;
create policy "audit_log: manager xem" on public.audit_log for select using ((select public.is_manager()));

drop policy if exists "photos: đăng nhập được upload vào thư mục của mình" on storage.objects;
create policy "photos: đăng nhập được upload vào thư mục của mình" on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "photos: đọc ảnh của mình hoặc manager" on storage.objects;
create policy "photos: đọc ảnh của mình hoặc manager" on storage.objects for select
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_manager())));

notify pgrst, 'reload schema';
