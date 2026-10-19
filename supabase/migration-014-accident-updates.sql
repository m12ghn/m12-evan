-- Migration 014: nhật ký cập nhật cho từng báo cáo tai nạn (kèm ảnh) + cập nhật bảo hiểm. Chạy được nhiều lần.

create table if not exists public.accident_updates (
  id uuid primary key default gen_random_uuid(),
  accident_id uuid not null references public.accidents(id) on delete cascade,
  created_at timestamptz not null default now(),
  author_id uuid references public.profiles(id),
  kind text not null default 'update' check (kind in ('update','insurance')),   -- update = diễn biến xử lý; insurance = bảo hiểm
  note text,
  photos jsonb not null default '[]'::jsonb,                                      -- đường dẫn ảnh trong Storage (tối đa 6)
  status_to text check (status_to in ('new','handling','done')),                  -- nếu lần cập nhật này đổi trạng thái
  check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 6),
  check (coalesce(trim(note), '') <> '' or jsonb_array_length(photos) > 0 or status_to is not null)
);
create index if not exists accident_updates_acc_idx on public.accident_updates (accident_id, created_at);

alter table public.accident_updates enable row level security;
drop policy if exists "accident_updates: manager xem" on public.accident_updates;
create policy "accident_updates: manager xem" on public.accident_updates for select using ((select public.is_manager()));
-- Không có policy insert/update/delete: chỉ ghi qua add_accident_update(), không ai sửa hay xóa được dòng đã lưu.
revoke all on public.accident_updates from anon, authenticated;
grant select on public.accident_updates to authenticated;

create or replace function public.add_accident_update(
  p_accident uuid, p_kind text, p_note text, p_photos jsonb, p_status text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.accidents; uid uuid := auth.uid(); nid uuid; st text; ph jsonb := coalesce(p_photos, '[]'::jsonb);
begin
  if uid is null or not public.is_manager() then raise exception 'Chỉ quản lý mới có quyền này'; end if;
  if p_kind not in ('update', 'insurance') then raise exception 'Loại cập nhật không hợp lệ'; end if;
  if p_status is not null and p_status not in ('new', 'handling', 'done') then raise exception 'Trạng thái không hợp lệ'; end if;
  select * into a from accidents where id = p_accident for update;
  if not found then raise exception 'Không tìm thấy báo cáo tai nạn'; end if;
  st := case when p_kind = 'update' and p_status is not null and p_status <> a.status then p_status end;
  if coalesce(trim(p_note), '') = '' and jsonb_array_length(ph) = 0 and st is null then
    raise exception 'Nhập nội dung, thêm ảnh hoặc đổi trạng thái';
  end if;
  insert into accident_updates (accident_id, author_id, kind, note, photos, status_to)
  values (p_accident, uid, p_kind, nullif(trim(p_note), ''), ph, st) returning id into nid;
  if st is not null then update accidents set status = st where id = p_accident; end if;
  return nid;
end $$;
revoke all on function public.add_accident_update(uuid, text, text, jsonb, text) from public;
grant execute on function public.add_accident_update(uuid, text, text, jsonb, text) to authenticated;

drop trigger if exists audit_accident_updates on public.accident_updates;
create trigger audit_accident_updates after insert or update or delete on public.accident_updates
  for each row execute function public.audit_row();

notify pgrst, 'reload schema';
