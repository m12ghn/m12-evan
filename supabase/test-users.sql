-- TÀI KHOẢN TEST — chạy trong Supabase → SQL Editor SAU KHI đã chạy schema.sql.
-- Đăng nhập trên app:
--   Admin : admin@fleetops.local   / Admin@12345
--   Tài xế: 10001 (MSNV)           / Driver@12345
-- XÓA hoặc đổi mật khẩu trước khi dùng thật.

-- Tạo lại hồ sơ cho các tài khoản đã tồn tại (cần khi chạy lại script sau khi bảng profiles bị tạo mới)
insert into public.profiles (id, full_name, email)
select id, raw_user_meta_data->>'full_name', email from auth.users
on conflict (id) do nothing;

do $$
declare
  u record;
  uid uuid;
begin
  for u in select * from (values
    ('admin@fleetops.local',  'Admin@12345',  'Admin Test',  'manager'),
    ('10001@fleetops.local',  'Driver@12345', 'Tài Xế Test', 'driver')
  ) as t(email, pw, full_name, role)
  loop
    select id into uid from auth.users where email = u.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', u.email,
        crypt(u.pw, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name),
        now(), now(), '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', u.email, 'email_verified', true),
        'email', now(), now(), now());
    end if;
    -- profile được trigger tạo tự động (role=driver); đặt lại role đúng
    update public.profiles set role = u.role, full_name = u.full_name where id = uid;
  end loop;
end $$;

select p.role, p.full_name, u.email from public.profiles p join auth.users u on u.id = p.id
where u.email in ('admin@fleetops.local', '10001@fleetops.local');
