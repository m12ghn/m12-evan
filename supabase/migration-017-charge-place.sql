-- Migration 017: nơi sạc điện do tài xế chọn: 'm12' = sạc tại kho M12 (kWh tính theo % pin), 'external' = sạc ngoài (AI đọc hóa đơn). Chạy được nhiều lần.
alter table public.refuels add column if not exists charge_place text check (charge_place in ('m12','external'));
notify pgrst, 'reload schema';
