# Máy chủ nhận thư chuyển tiếp (hướng thương mại)

Cách hoạt động: mỗi người dùng được cấp một địa chỉ riêng `uXXXXXXXXXXXX@tên-miền-của-bạn`.
Họ bật bộ lọc Gmail chuyển tiếp thư của ngân hàng tới địa chỉ đó. Worker đọc thư, chỉ lưu kết quả
(giao dịch, sao kê, nhắc nợ), KHÔNG lưu nội dung thư, và trả JSON cho app cùng định dạng với bản Apps Script.

## Việc bạn cần làm (một lần)
1. Mua một tên miền (khoảng 10 USD/năm) và thêm vào Cloudflare (miễn phí).
2. Cloudflare → Email → Email Routing → bật, rồi tạo **Catch-all** gửi tới Worker `the-tin-dung-mail` (sau bước 4).
3. `npm install`, rồi `npx wrangler kv namespace create USERS`; dán `id` vào `wrangler.toml`; sửa `MAIL_DOMAIN`.
4. `npx wrangler deploy` (cần đăng nhập Cloudflare). Ghi lại địa chỉ Worker (…workers.dev).
5. Gửi địa chỉ Worker cho Claude để điền vào app (`CLOUD_URL` trong the/app.js).

## Trước khi mở cho người ngoài
- Đăng ký xử lý dữ liệu cá nhân, có chính sách quyền riêng tư và điều khoản (Nghị định 13/2023/NĐ-CP).
- Cho người dùng nút xóa tài khoản (đã có: DELETE /api/<alias>) và nói rõ cách tắt chuyển tiếp trong Gmail.
- Mỗi ngân hàng mới cần một thư mẫu để viết plugin trong `parsers.js` (kèm ca thử).
