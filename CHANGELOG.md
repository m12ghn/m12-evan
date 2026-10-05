# Nhật ký cập nhật FleetOps

_File này được tạo tự động từ `src/changelog.json` (chạy `npm run changelog`). Cùng nội dung hiển thị trong app: trang Quản lý → tab 📝 Cập nhật._

## 05/10/2026 (Thứ hai)

### ✨ Tính năng mới

- **Nhật ký cập nhật app (tab 📝 Cập nhật)** _(Quản lý)_ — Xem app đã được điều chỉnh gì theo từng ngày: thêm tính năng, chỉnh nút, sửa lỗi… Có lọc theo loại và ô tìm kiếm. Cũng có file CHANGELOG.md trong repo.
- **Nhật ký thao tác (tab 🧾 Nhật ký)** _(Quản lý)_ — Tự ghi lại mọi thêm/sửa/xóa dữ liệu (kèm giá trị cũ → mới), đăng nhập/đăng xuất, tạo tài khoản, đổi tên đăng nhập, đổi mật khẩu, cho nghỉ việc. Lọc theo ngày/người/đối tượng/hành động, tải Excel. Không ai sửa hoặc xóa được nhật ký. `119c990`
- **Mục 🚨 Báo cáo tai nạn** _(Tài xế)_ — Dùng được cả khi chưa vào ca. Nhập địa điểm, mô tả, chọn xe liên quan; ảnh tối đa 6 (chụp hoặc chọn từ máy, xóa được từng ảnh). Quản lý có tab 🚨 Tai nạn để xem ảnh, đổi trạng thái, ghi chú, chuyển xe sang đang sửa chữa. `9b57273`
- **Người dùng có trạng thái Còn làm / Đã nghỉ** _(Quản lý)_ — Nút "Cho nghỉ việc" / "Cho đi làm lại" trong Cài đặt. Người đã nghỉ bị khóa đăng nhập. Không cho nghỉ việc người đang có ca chưa trả xe. `9b57273`
- **Thêm 2 trạng thái xe: Ngưng hoạt động, Đang sửa chữa tai nạn** _(Quản lý)_ — Có trong bộ lọc Đội xe, form sửa xe và file Excel thêm xe. Xe ở hai trạng thái này tài xế không nhận được. `9b57273`
- **Cấp nhiên liệu/điện: nhiều ảnh theo loại xe + chọn ảnh từ máy** _(Tài xế)_ — Xe xăng/dầu 4 ảnh (trước khi đổ, sau khi đổ, đồng hồ trạm xăng, hóa đơn). Xe điện 3 ảnh (trước khi sạc, sau khi sạc, hóa đơn/lịch sử sạc). Mỗi ô ảnh cho chọn Chụp ảnh hoặc Chọn từ máy (vd. ảnh chụp màn hình). Trang quản lý xem đủ ảnh. `42b0c2a`

### 🔧 Chỉnh sửa

- **Cấp điện: thay các ô nhập cũ bằng 6 ô mới** _(Tài xế)_ — ĐỒNG HỒ ODO, PIN TRƯỚC KHI SẠC (0–100%), PIN SAU KHI SẠC (0–100%), KWH (có số thập phân), THỜI GIAN SẠC (phút), THÀNH TIỀN (VND, tự hiện dạng 214,000). Phiếu cũ giữ nguyên. Trang quản lý hiển thị pin trước → sau, kWh, phút sạc, thành tiền. `9b57273`

### 🐞 Sửa lỗi

- **Mở ảnh ở tab mới không làm tab gốc bị tải lại** _(Cả hai)_ — Trước đây quay lại tab gốc thì trang quản lý bị dựng lại, mất bộ lọc và chi tiết đang mở. `4a90d9c`

### ⚙️ Hệ thống

- **Cập nhật cơ sở dữ liệu: migration 004, 005, 006** _(Cả hai)_ — 004: nhiều ảnh cho phiếu nhiên liệu/điện. 005: phiếu sạc điện, trạng thái nghỉ việc, trạng thái xe mới, bảng báo cáo tai nạn. 006: nhật ký thao tác.

## 01/10/2026 (Thứ năm)

### ✨ Tính năng mới

- **Trang quản lý: Đội xe, Nhật ký ca, Duyệt nhiên liệu/điện, Cài đặt** _(Quản lý)_ — Đội xe có KPI, tìm kiếm, lọc trạng thái. Nhật ký ca xem ảnh đầu/cuối ca, cảnh báo vượt định mức. Duyệt/từ chối phiếu kèm ghi chú. Cài đặt thêm/sửa xe và hồ sơ người dùng. `308a5c9`
- **Tự đăng xuất sau 3 ngày** _(Cả hai)_ — Bắt đăng nhập lại sau 3 ngày kể từ lần đăng nhập gần nhất (kiểm tra khi mở lại tab và mỗi 10 phút). `0649416`
- **Logo GHN** _(Cả hai)_ — Hiện ở màn hình đăng nhập, thanh đầu trang và biểu tượng tab trình duyệt. `85b8801`
- **Đổi tên đăng nhập, mật khẩu và tạo người dùng ngay trên web** _(Quản lý)_ — Nút "Đổi TK / MK" và "+ Thêm người dùng" trong Cài đặt. Chạy qua hàm server (Vercel Function) vì cần khóa quản trị. `85b8801`
- **Thêm xe hàng loạt bằng Excel** _(Quản lý)_ — Tải file mẫu, điền rồi tải lên. Hiện xem trước và lỗi theo từng dòng. Biển số đã có thì chỉ cập nhật thông tin xe. `85b8801`
- **Nhật ký ca: bộ lọc và tải Excel** _(Quản lý)_ — Lọc theo ngày, loại xe, xăng/dầu hoặc điện, tài xế, trạng thái, chỉ ca có sự cố, chỉ ca vượt định mức. Tải Excel gồm chi tiết ca và tổng hợp theo xe. `85b8801`

### 🔧 Chỉnh sửa

- **Báo lỗi rõ khi không tải được ca hoặc xe** _(Tài xế)_ — Thêm dòng hướng dẫn khi chưa có ca đang chạy; chặn mở ca mới khi còn ca chưa trả xe. `0094f92`

### 🐞 Sửa lỗi

- **Sửa lỗi kết thúc ca báo "violates row-level security"** _(Tài xế)_ — Nhận xe và trả xe giờ chạy trọn gói trong cơ sở dữ liệu (kiểm tra hợp lệ, tính tiêu hao, cập nhật xe cùng lúc). Tài xế không còn sửa trực tiếp bảng xe và bảng ca. `82c403a`
- **Sửa crash trên Android khi chụp hình** _(Tài xế)_ — Chụp ảnh ngay trong trang (không mở app camera ngoài nữa), lưu nháp tự động kể cả ảnh, nhớ màn hình đang mở, nén ảnh nhẹ RAM hơn. Máy không hỗ trợ thì tự dùng camera của máy. `4ed8fe6`
- **Tạo/đổi tài khoản báo lỗi rõ và hoàn tác khi thất bại** _(Quản lý)_ — Không để lại tài khoản dở dang khi không lưu được hồ sơ. `ad0545e`

## 30/09/2026 (Thứ tư)

### ✨ Tính năng mới

- **Khởi tạo app từ bản prototype FleetOps** _(Cả hai)_ — Một đường link duy nhất, đăng nhập xong tự vào trang Quản lý hoặc trang Tài xế theo quyền. Kết nối Supabase + Vercel + GitHub. `f1e7ad5`
- **Trang tài xế với 3 chức năng** _(Tài xế)_ — Chụp hình đầu ca (ODO, mức nhiên liệu/pin, 5 ảnh), Cấp nhiên liệu / Cấp điện (một phiếu chung cho xe xăng/dầu và xe điện), Chụp hình cuối ca (ODO cuối, 5 ảnh, tình trạng xe, tự tính tiêu hao). `b406179`

### 🔧 Chỉnh sửa

- **Giao diện theo bảng màu GHN** _(Cả hai)_ — Màu teal GHN, font Roboto, bo góc 12, nút gradient; trang tài xế giới hạn 480px. Ảnh lưu trên Supabase Storage, đọc lại bằng đường dẫn có hạn 7 ngày. `0e4f342`
- **Đăng nhập bằng MSNV** _(Cả hai)_ — Tài xế gõ MSNV (tự đổi thành email nội bộ). Quản lý có thể dùng email. `d16eb76`
- **Cấu hình dùng SUPABASE_URL / SUPABASE_ANON_KEY** _(Cả hai)_ — Không cần tiền tố VITE_ khi khai báo trên Vercel. `d616c2e`

### ⚙️ Hệ thống

- **Thiết lập cơ sở dữ liệu và tài khoản thử** _(Cả hai)_ — File setup-all.sql tạo bảng, phân quyền, xe mẫu và 2 tài khoản thử (admin, tài xế). Sửa lỗi không đặt được quyền từ SQL Editor. `a593cb3`
