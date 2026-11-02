-- Migration 016: thêm giờ sạc trên ảnh (để phát hiện ảnh cũ) và thời lượng sạc vào kết quả AI. Chạy được nhiều lần.
alter table public.refuel_ai add column if not exists charged_ts timestamptz;   -- ngày giờ bắt đầu sạc đọc từ ảnh
alter table public.refuel_ai add column if not exists duration_min int;          -- thời lượng sạc (phút) đọc từ ảnh
notify pgrst, 'reload schema';
