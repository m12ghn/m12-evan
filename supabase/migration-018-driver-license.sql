-- Migration 018: số GPLX (giấy phép lái xe) và hạn GPLX của người dùng. Chạy được nhiều lần.
-- (cột license cũ = hạng bằng, vd. B2 / C / FC)
alter table public.profiles add column if not exists license_no text;        -- số GPLX
alter table public.profiles add column if not exists license_expiry date;    -- hạn GPLX
notify pgrst, 'reload schema';
