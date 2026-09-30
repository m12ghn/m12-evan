-- Dữ liệu mẫu (trích từ prototype). Chạy sau schema.sql.
insert into vehicles (plate, type, energy_type, capacity, std_rate, fuel_type, odo, energy_level, status) values
 ('29H-102.34','Tải 1.5 Tấn - Kia K250','fuel',60,10.5,'Dầu Diesel (DO)',45200,75,'ready'),
 ('29C-543.21','Tải 2.4 Tấn - Isuzu QKR','fuel',75,11.8,'Dầu Diesel (DO)',68150,60,'ready'),
 ('51D-891.22','Tải 1.9 Tấn - Hyundai Mighty','fuel',70,11.2,'Dầu Diesel (DO)',52400,85,'ready'),
 ('60C-321.45','Tải 3.5 Tấn - Hino 300','fuel',100,13.5,'Dầu Diesel (DO)',91200,45,'ready'),
 ('50H-123.90','Tải 1.4 Tấn - Suzuki Pro','fuel',45,7.5,'Xăng RON 95',21300,80,'ready'),
 ('51K-888.99','Xe điện VinFast EC Van','electric',17,14,'Điện',3200,90,'ready');
-- Danh sách đầy đủ 22 xe: xem prototype/app.js (INITIAL_VEHICLES)
