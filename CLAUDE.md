# FleetOps — quy ước làm việc

## Nhật ký cập nhật app (BẮT BUỘC)
Mỗi lần điều chỉnh app (thêm/đổi tính năng, chỉnh nút/giao diện, thêm ô nhập/ảnh, sửa lỗi, đổi cơ sở dữ liệu…):
1. Thêm mục vào đầu danh sách ngày tương ứng trong `src/changelog.json` (tạo ngày mới nếu chưa có; ngày mới nhất ở trên cùng).
   - `type`: `new` (tính năng mới) | `change` (chỉnh sửa) | `fix` (sửa lỗi) | `system` (hệ thống/CSDL)
   - `scope`: `driver` | `manager` | `all`
   - `title`: ngắn gọn; `detail`: người dùng thấy gì thay đổi; `commit`: mã commit nếu có.
2. Chạy `npm run changelog` để cập nhật `CHANGELOG.md`.
3. Commit cùng thay đổi. Nhật ký hiển thị trong app: Quản lý → tab 📝 Cập nhật.

## Khác
- Ngôn ngữ giao diện và nhật ký: tiếng Việt.
- Thay đổi cơ sở dữ liệu: thêm file `supabase/migration-NNN-*.sql` (chạy lại được) và cập nhật `supabase/schema.sql`, `supabase/setup-all.sql`.
