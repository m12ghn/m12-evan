-- Migration 010: cho phép trạng thái skipped (chưa gửi vì thiếu cấu hình) trong nhật ký Telegram. Chạy được nhiều lần.
alter table public.telegram_log drop constraint if exists telegram_log_status_check;
alter table public.telegram_log add constraint telegram_log_status_check
  check (status in ('pending','sent','failed','skipped'));
notify pgrst, 'reload schema';
