-- Phiếu cấp nhiên liệu/điện: lưu nhiều ảnh (xăng/dầu 4 ảnh, điện 3 ảnh) trong cột jsonb `photos`
alter table public.refuels add column if not exists photos jsonb;
-- Giữ ảnh của các phiếu cũ (trước đây chỉ có cột photo_pump, photo_receipt)
update public.refuels
  set photos = jsonb_strip_nulls(jsonb_build_object('pump', photo_pump, 'receipt', photo_receipt))
  where photos is null;
notify pgrst, 'reload schema';
