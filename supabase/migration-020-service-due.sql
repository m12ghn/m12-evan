-- Migration 020: mốc bảo dưỡng định kỳ (BTBD) của từng xe để cảnh báo xe sắp tới hạn. Chạy được nhiều lần.
-- Nguồn: sheet "Data BTBD" (cột Km BD định kì tiếp theo / Km BD còn lại / Thông báo), nhập qua Cài đặt → Cập nhật mốc BTBD từ Excel.
alter table public.vehicles add column if not exists service_next_km integer;        -- Km bảo dưỡng định kỳ tiếp theo
alter table public.vehicles add column if not exists service_sheet_left_km integer;  -- Km còn lại theo sheet lúc nhập (tham khảo)
alter table public.vehicles add column if not exists service_sheet_notice text;      -- Phân loại BTBD theo sheet lúc nhập (vd. Chưa đến kỳ BD)
alter table public.vehicles add column if not exists service_synced_at timestamptz;  -- lần cập nhật mốc BTBD gần nhất
notify pgrst, 'reload schema';
