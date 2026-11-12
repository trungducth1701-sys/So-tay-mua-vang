# Sổ vàng (app cài lên iPhone)

## Đưa app lên mạng (làm một lần, khoảng 5 phút)
1. Vào github.com, đăng nhập, tạo repository mới tên `so-vang`, chọn **Public**.
2. Bấm **Add file > Upload files**, kéo toàn bộ nội dung thư mục này vào (kể cả thư mục `.github`, `icons`, `scripts`), bấm **Commit**.
   Nếu GitHub không nhận thư mục `.github`, tạo tay tệp `.github/workflows/update-price.yml` rồi dán nội dung vào.
3. **Settings > Pages**: Source chọn *Deploy from a branch*, Branch `main`, thư mục `/ (root)`, bấm Save.
4. **Settings > Actions > General > Workflow permissions**: chọn *Read and write permissions*, Save.
5. Tab **Actions > Cập nhật giá SJC > Run workflow** để lấy giá lần đầu.
6. Địa chỉ app: `https://<tên-github>.github.io/so-vang/`

## Cài lên iPhone
Mở địa chỉ trên bằng **Safari** > nút Chia sẻ > **Thêm vào Màn hình chính**.
Mở app từ biểu tượng mới > Cài đặt > **Khôi phục từ tệp** (chọn tệp `so-vang-sao-luu.json`).

Dữ liệu vàng chỉ nằm trên điện thoại, không đưa lên GitHub. Hãy bấm "Lưu bản sao lưu" định kỳ.
