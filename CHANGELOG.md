# Nhật ký cập nhật FleetOps

_File này được tạo tự động từ `src/changelog.json` (chạy `npm run changelog`). Cùng nội dung hiển thị trong app: trang Quản lý → tab 📝 Cập nhật._

## 05/10/2026 (Thứ hai)

### ✨ Tính năng mới

- **Thông báo Telegram: vào ca, sạc điện, kết thúc ca** _(Cả hai)_ — Khi tài xế vào ca, gửi phiếu sạc điện / đổ nhiên liệu, hoặc kết thúc ca, bot tự gửi tin theo mẫu GHN (HỌ TÊN, BKS, ĐỒNG HỒ ODO, % pin, giờ vào/kết thúc ca, kWh, thời gian sạc…) kèm các ảnh đã chụp vào nhóm Telegram. Quản lý cài Chat ID, gửi tin thử, xem nhật ký gửi, gửi lại tin lỗi và quét gửi bù ở Cài đặt → Thông báo Telegram. Mỗi sự kiện chỉ gửi một lần.
- **Nhật ký cập nhật app (tab 📝 Cập nhật)** _(Quản lý)_ — Xem app đã được điều chỉnh gì theo từng ngày: thêm tính năng, chỉnh nút, sửa lỗi… Có lọc theo loại và ô tìm kiếm. Cũng có file CHANGELOG.md trong repo.
- **Nhật ký thao tác (tab 🧾 Nhật ký)** _(Quản lý)_ — Tự ghi lại mọi thêm/sửa/xóa dữ liệu (kèm giá trị cũ → mới), đăng nhập/đăng xuất, tạo tài khoản, đổi tên đăng nhập, đổi mật khẩu, cho nghỉ việc. Lọc theo ngày/người/đối tượng/hành động, tải Excel. Không ai sửa hoặc xóa được nhật ký. `119c990`
- **Mục 🚨 Báo cáo tai nạn** _(Tài xế)_ — Dùng được cả khi chưa vào ca. Nhập địa điểm, mô tả, chọn xe liên quan; ảnh tối đa 6 (chụp hoặc chọn từ máy, xóa được từng ảnh). Quản lý có tab 🚨 Tai nạn để xem ảnh, đổi trạng thái, ghi chú, chuyển xe sang đang sửa chữa. `9b57273`
- **Người dùng có trạng thái Còn làm / Đã nghỉ** _(Quản lý)_ — Nút "Cho nghỉ việc" / "Cho đi làm lại" trong Cài đặt. Người đã nghỉ bị khóa đăng nhập. Không cho nghỉ việc người đang có ca chưa trả xe. `9b57273`
- **Thêm 2 trạng thái xe: Ngưng hoạt động, Đang sửa chữa tai nạn** _(Quản lý)_ — Có trong bộ lọc Đội xe, form sửa xe và file Excel thêm xe. Xe ở hai trạng thái này tài xế không nhận được. `9b57273`
- **Cấp nhiên liệu/điện: nhiều ảnh theo loại xe + chọn ảnh từ máy** _(Tài xế)_ — Xe xăng/dầu 4 ảnh (trước khi đổ, sau khi đổ, đồng hồ trạm xăng, hóa đơn). Xe điện 3 ảnh (trước khi sạc, sau khi sạc, hóa đơn/lịch sử sạc). Mỗi ô ảnh cho chọn Chụp ảnh hoặc Chọn từ máy (vd. ảnh chụp màn hình). Trang quản lý xem đủ ảnh. `42b0c2a`

### 🔧 Chỉnh sửa

- **Telegram: database tự gửi tin ngay khi có dữ liệu mới** _(Cả hai)_ — Thay vì chờ điện thoại tài xế báo lại, database tự kích hoạt (trigger) gửi tin ngay lúc ca/phiếu được lưu, kể cả khi điện thoại mất mạng. Có lịch quét bù tự động mỗi 5 phút cho tin bị lỡ. Cài đặt ở Cài đặt → Thông báo Telegram → Gửi tự động (mã bí mật, kiểm tra kết nối). Mỗi sự kiện vẫn chỉ gửi một lần.
- **Telegram: hỗ trợ nhóm có chủ đề (topic)** _(Quản lý)_ — Chat ID nhập dạng -100…_mã_topic (vd -1003936059980_8) để gửi vào đúng chủ đề; mỗi loại tin (vào ca, sạc điện, kết thúc ca) vào một chủ đề riêng.
- **Tải ảnh nhanh và chắc hơn trên mạng yếu** _(Tài xế)_ — Tải tối đa 3 ảnh cùng lúc (trước đây lần lượt từng ảnh), tự thử lại khi lỗi mạng, hiện tiến độ "Đang tải ảnh 2/5…", gửi lại không tải trùng ảnh. Áp dụng cho chụp đầu ca, cuối ca, cấp nhiên liệu/điện và báo cáo tai nạn.
- **Chụp đầu ca: hiện ODO chốt ca trước và cảnh báo khi số lệch** _(Tài xế)_ — Cảnh báo đỏ nếu ODO nhập thấp hơn ODO ca trước hoặc cao hơn (kèm số km chênh). Ô ODO chỉ nhận chữ số.
- **Xem ảnh trong chi tiết nhanh hơn** _(Quản lý)_ — Ký đường dẫn cả bộ ảnh trong một yêu cầu thay vì từng ảnh một.
- **Nhật ký ca: cảnh báo ca quá 12 giờ chưa trả xe** _(Quản lý)_ — Ca đang chạy quá 12 giờ hiện dòng đỏ "Quá 12 giờ chưa trả xe".
- **Tách gói tải theo quyền** _(Cả hai)_ — Tài xế không còn tải mã trang quản lý (và ngược lại); có chữ "Đang tải…" khi mở trang.
- **Báo cáo tai nạn: bắt buộc chọn "Xe bị tai nạn"** _(Tài xế)_ — Đổi ô "Xe liên quan" (tùy chọn) thành "Xe bị tai nạn" (bắt buộc). Xe đang chạy được đưa lên đầu danh sách và chọn sẵn. Lịch sử báo cáo của tài xế hiện thêm biển số xe.
- **Cấp điện: thay các ô nhập cũ bằng 6 ô mới** _(Tài xế)_ — ĐỒNG HỒ ODO, PIN TRƯỚC KHI SẠC (0–100%), PIN SAU KHI SẠC (0–100%), KWH (có số thập phân), THỜI GIAN SẠC (phút), THÀNH TIỀN (VND, tự hiện dạng 214,000). Phiếu cũ giữ nguyên. Trang quản lý hiển thị pin trước → sau, kWh, phút sạc, thành tiền. `9b57273`

### 🐞 Sửa lỗi

- **Gửi lại sau khi mất mạng không bị tạo trùng hoặc báo lỗi nhầm** _(Tài xế)_ — Phiếu nhiên liệu/điện và báo cáo tai nạn không bị ghi hai lần khi gửi lại. Nhận xe/trả xe mà lần trước đã thành công thì tự làm mới màn hình thay vì báo lỗi.
- **Duyệt phiếu: phiếu cũ không còn hiện biển số "—"** _(Quản lý)_ — Trước đây chỉ tra cứu xe trong 500 ca gần nhất nên phiếu của ca cũ bị mất biển số.
- **Mở ảnh ở tab mới không làm tab gốc bị tải lại** _(Cả hai)_ — Trước đây quay lại tab gốc thì trang quản lý bị dựng lại, mất bộ lọc và chi tiết đang mở. `4a90d9c`

### ⚙️ Hệ thống

- **Cơ sở dữ liệu: migration 009 (trigger Telegram)** _(Cả hai)_ — Trigger trên bảng ca và phiếu dùng pg_net gọi máy chủ; bảng cấu hình riêng tư (private_config) chứa địa chỉ và mã bí mật, không ai đọc được qua app; pg_cron quét bù mỗi 5 phút.
- **Cơ sở dữ liệu: migration 008 (Telegram)** _(Cả hai)_ — Thêm bảng cài đặt chung (app_settings) và nhật ký gửi Telegram (telegram_log). Token bot không lưu trong cơ sở dữ liệu mà ở biến môi trường TELEGRAM_BOT_TOKEN trên Vercel.
- **Cơ sở dữ liệu: migration 007 (hiệu năng + bảo mật)** _(Cả hai)_ — Thêm chỉ mục cho các truy vấn thường dùng; viết lại chính sách phân quyền theo khuyến nghị hiệu năng của Supabase; người dùng không còn tự đổi được quyền, trạng thái làm việc hay tên đăng nhập của mình.
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
