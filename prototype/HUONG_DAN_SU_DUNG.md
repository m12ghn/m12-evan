# Hướng Dẫn Sử Dụng & Báo Cáo Triển Khai: Hệ Thống Kiểm Soát Vận Hành Xe, ODO & Nhiên Liệu (FleetOps)

Hệ thống đã được thiết kế và triển khai hoàn thiện tại thư mục:  
📁 **`c:\Users\pc\Desktop\quan-ly-xe-odo`**  
Mở trực tiếp file: [index.html](file:///c:/Users/pc/Desktop/quan-ly-xe-odo/index.html) bằng bất kỳ trình duyệt nào (Chrome, Edge, Cốc Cốc, Safari trên điện thoại hoặc máy tính) mà không cần cài đặt thêm phần mềm máy chủ.

---

## 🌟 Các Tính Năng Đã Hoàn Thiện

### 1. Kênh Thu Thập Dành Cho Tài Xế (Mobile-Friendly Web App)
- **Lúc nhận xe (Đầu ca)**:
  - Tài xế chọn tên và chọn phương tiện nhận bàn giao (hệ thống tự lọc các xe đang sẵn sàng tại bãi).
  - Tự động hiển thị chỉ số ODO chốt từ ca trước để đối chiếu.
  - Nhập **chỉ số ODO ban đầu** và **mức nhiên liệu (%)**, tự động tính số lít xăng/dầu ước tính dựa trên dung tích bình xe.
  - **Chụp ảnh taplo** (đồng hồ ODO + kim xăng/dầu).
  - **Chụp ảnh ngoại quan 4 góc xe** (Đầu xe, Đuôi xe, Sườn trái, Sườn phải) kèm ô ghi chú các vết trầy xước/hư hỏng có sẵn (nếu có) để bảo vệ tài xế, tránh bị quy trách nhiệm khi trả xe.
  - Tích chọn xác nhận và bắt đầu ca chạy.
- **Trong ca vận hành**:
  - Giao diện ca xe trực quan (hiển thị ODO xuất phát, mức nhiên liệu đầu ca, giờ bắt đầu).
  - Nút **"Xin Cấp & Đổ Nhiên Liệu Trong Ca"**:
    - Nhập loại nhiên liệu (Dầu Diesel DO 0.05S, Xăng RON 95...), số ODO tại cây xăng.
    - Nhập số lít, đơn giá $\rightarrow$ hệ thống tự tính thành tiền.
    - **Chụp ảnh đồng hồ cột bơm** (xác thực số lít và số tiền thực tế).
    - **Chụp ảnh hóa đơn VAT / Phiếu thu xăng dầu**.
    - Gửi phiếu $\rightarrow$ chuyển trạng thái *Chờ duyệt* gửi ngay đến Quản lý.
  - Xem danh sách lịch sử các lần tiếp nhiên liệu trong ca.
- **Lúc trả xe (Cuối ca)**:
  - Nhập **chỉ số ODO kết thúc** (có kiểm tra chống nhập lùi: ODO trả xe phải $\ge$ ODO nhận xe).
  - Nhập **mức nhiên liệu còn lại** khi về bãi.
  - **Tự động tính toán tức thì**:
    - Quãng đường di chuyển trong ngày (km).
    - Lượng nhiên liệu tiêu thụ ước tính (Lít).
    - Định mức tiêu hao thực tế (L/100km).
  - **Chụp lại 4 ảnh xung quanh xe sau ca** và **ảnh taplo chốt ca** để xác thực **XE KHÔNG BỊ HƯ HAO / MÓP MÉO**.
  - Khai báo tình trạng: Xe nguyên vẹn hoặc ghi chú chi tiết sự cố va quẹt / hư hỏng máy móc nếu có.
  - Xem tóm tắt toàn bộ ca chạy và nộp biên bản bàn giao.

---

### 2. Bảng Điều Khiển Quản Lý Đội Xe (>20 Phương Tiện)
Chuyển đổi tức thì bằng nút **"📊 Quản Lý Xe"** trên thanh điều hướng trên cùng:
- **Thanh chỉ số KPI tổng quan**:
  - Tổng số xe trong đội (sẵn có 22 xe mẫu thực tế).
  - Số lượng xe đang vận hành (On-duty).
  - Số lượng xe sẵn sàng tại bãi (Ready).
  - Số lượng phiếu cấp nhiên liệu đang chờ duyệt (Pending fuel).
  - Tổng quãng đường toàn đội xe đã di chuyển trong ngày (km).
- **Tab 1: Danh sách Đội xe (20+ xe)**:
  - Hiển thị dạng thẻ trực quan (Card Grid) cho từng xe: Biển số, loại xe (Tải 1.5T, Tải 2.5T, Tải 5T, Tải 8T, Xe Van, Bán tải...), ODO hiện tại, thanh báo % nhiên liệu còn lại, tài xế đang cầm lái.
  - Bộ lọc nhanh: Tất cả, Đang chạy, Tại bãi, Cần bảo dưỡng.
  - Ô tìm kiếm thông minh theo biển số xe hoặc tên tài xế.
- **Tab 2: Nhật ký Ca chạy & Bộ Soi Ảnh Hư Hao (Side-by-side Photo Inspector)**:
  - Bảng kê chi tiết từng chuyến xe: Biển số, Tài xế, Giờ nhận $\rightarrow$ trả, ODO, Quãng đường (km), Nhiên liệu tiêu hao, Tỷ lệ L/100km (cảnh báo đỏ nếu vượt quá 15% định mức chuẩn của xe).
  - Nút **"🔍 Soi Ảnh Đối Soát"**:
    - Mở cửa sổ so sánh song song **Ảnh lúc nhận xe (Trước ca)** vs **Ảnh lúc trả xe (Sau ca)** cho từng góc: Đầu xe, Đuôi xe, Sườn trái, Sườn phải, Taplo ODO.
    - Hỗ trợ phóng to rê chuột để soi rõ các vết xước hoặc móp méo.
    - Cảnh báo nổi bật nếu tài xế khai báo có sự cố trong ca.
    - Nút in biên bản bàn giao (Print Handover Report).
- **Tab 3: Quản lý Cấp Nhiên liệu & Duyệt Phiếu**:
  - Danh sách phiếu tiếp xăng dầu theo thời gian thực.
  - Xem ảnh đồng hồ cột bơm và ảnh hóa đơn VAT để kiểm tra đối chiếu.
  - Nút **Phê duyệt** hoặc **Từ chối** có ghi chú của quản lý.
  - Tự động thống kê tổng tiền nhiên liệu đã duyệt hôm nay.
- **Tab 4: Cấu hình Phương tiện & Tài xế**:
  - Thêm / bớt / chỉnh sửa thông tin xe (>20 xe mẫu: Biển số, Dung tích bình xăng, Định mức chuẩn L/100km, ODO ban đầu).
  - Thêm / bớt / chỉnh sửa danh sách tài xế (Họ tên, Số điện thoại, Hạng bằng lái B2, C, D, FC).
- **Xuất Dữ Liệu Báo Cáo**:
  - Nút **"📥 Xuất Excel Báo Cáo"** tạo file `.csv` chuẩn mã hóa UTF-8 BOM, mở trực tiếp bằng Microsoft Excel mà không bị lỗi font chữ tiếng Việt.

---

## 🛠️ Công Nghệ & Tối Ưu Hóa
1. **Engine nén ảnh tự động (Client-side Canvas Image Compression)**:
   - Khi tài xế chụp ảnh từ camera điện thoại (thường dung lượng 3MB - 10MB/ảnh), hệ thống tự động co kích thước và nén nhẹ định dạng JPEG chất lượng cao, giữ cho kích thước lưu trữ siêu nhẹ, tải nhanh và không làm đầy bộ nhớ trình duyệt.
2. **Lưu trữ Offline-Ready (LocalStorage)**:
   - Dữ liệu được lưu trữ trực tiếp trên máy, không mất khi tải lại trang, tài xế mất mạng tạm thời vẫn thao tác được.
3. **Responsive 100%**:
   - Giao diện tài xế tối ưu màn hình cảm ứng điện thoại: Nút to, hướng dẫn từng bước (Wizard steps) dễ thao tác ngoài bãi xe nắng chói.
   - Giao diện quản lý tối ưu hiển thị trên màn hình máy tính hoặc iPad/máy tính bảng của điều phối viên.

---

## 🚀 Hướng Dẫn Thử Nghiệm Nhanh

1. Mở file [index.html](file:///c:/Users/pc/Desktop/quan-ly-xe-odo/index.html).
2. **Thử nghiệm ca nhận xe mới**:
   - Ở chế độ **Tài Xế**, chọn tài xế `Lê Hoàng Nam`.
   - Chọn phương tiện bàn giao `29C-543.21` $\rightarrow$ Nhấn **"Tiến Hành Nhận Xe & Chụp Ảnh"**.
   - Kiểm tra ODO, kéo mức xăng, bấm vào các khung ảnh để tải ảnh hoặc chụp camera.
   - Hoàn thành nhận xe $\rightarrow$ Chuyển vào màn hình điều khiển ca chạy.
3. **Thử nghiệm đổ nhiên liệu**:
   - Nhấn **"+ Tạo Phiếu Đổ Nhiên Liệu Mới"** $\rightarrow$ Nhập số lít, chụp ảnh cây xăng & hóa đơn $\rightarrow$ Gửi phiếu.
4. **Thử nghiệm trả xe & soi ảnh**:
   - Nhấn **"🏁 Về Trả Xe & Chốt Ca Vận Hành"** $\rightarrow$ Nhập ODO kết thúc, chụp 4 ảnh sau ca $\rightarrow$ Nộp báo cáo.
   - Chuyển sang nút **"📊 Quản Lý Xe"** trên cùng $\rightarrow$ Vào tab **"Nhật Ký Ca Chạy & Soi Ảnh"** $\rightarrow$ Bấm **"🔍 Soi Ảnh Đối Soát"** để xem bộ so sánh ảnh Trước và Sau ca.
