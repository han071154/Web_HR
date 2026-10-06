# Kiểm tra bảo mật cơ bản (OWASP Top 10) — module Nhân sự

Rà soát nhanh backend (`backend/src`) theo OWASP Top 10 (2021). Mục tiêu là ghi lại hiện trạng,
không phải một lần kiểm thử xâm nhập đầy đủ.

| # | Rủi ro | Hiện trạng | Việc cần làm |
| --- | --- | --- | --- |
| A01 | Broken Access Control | Mọi route (trừ `/auth/*`, `/public/*`, `/api/health`, `/api/docs`) đi qua `requireAuth`; các thao tác tạo/sửa/xóa đều có `requireRole` theo đúng vai trò ADMIN/HR_MANAGER/HR_STAFF. | Không có |
| A02 | Cryptographic Failures | Mật khẩu hash bằng bcrypt (cost 12). JWT ký bằng `JWT_SECRET`/`JWT_REFRESH_SECRET`, nhưng code có giá trị mặc định (`dev_secret`, `dev_refresh_secret`) khi thiếu biến môi trường. | **Bắt buộc đặt `JWT_SECRET` và `JWT_REFRESH_SECRET` (chuỗi ngẫu nhiên dài) ở mọi môi trường ngoài local.** Triển khai sau HTTPS/reverse proxy (ngoài phạm vi repo này). |
| A03 | Injection | Toàn bộ câu SQL dùng tham số hóa (`$1, $2, ...`), không nối chuỗi input vào SQL ở bất kỳ route nào đã rà soát. | Không có |
| A04 | Insecure Design | `/auth/login` và `/auth/refresh` trước đây không giới hạn số lần thử → dễ bị dò mật khẩu (brute-force). | **Đã sửa**: thêm rate limit 20 request/15 phút/IP (`backend/src/middleware/rateLimit.js`). |
| A05 | Security Misconfiguration | `helmet()` bật mặc định; CORS giới hạn theo whitelist `CORS_ORIGIN`; lỗi hệ thống trả message chung, không lộ stack trace. | Không có |
| A06 | Vulnerable and Outdated Components | Chưa có bước tự động kiểm tra lỗ hổng dependency trong CI. | Khuyến nghị chạy `npm audit` định kỳ hoặc thêm bước audit vào CI. |
| A07 | Identification and Authentication Failures | Hash mật khẩu đúng chuẩn; JWT có hạn dùng; đã có rate limit chống brute-force (xem A04). Chưa có khóa tài khoản tạm thời sau nhiều lần đăng nhập sai liên tiếp. | Có thể bổ sung khóa tài khoản tạm thời nếu quy mô người dùng lớn hơn; hiện tại rate limit theo IP là đủ cho quy mô nội bộ. |
| A08 | Software and Data Integrity Failures | Upload file kiểm tra cả mimetype lẫn nội dung thật: CV kiểm tra 4 byte đầu phải là `%PDF` (`isPdfFile`), Excel kiểm tra mimetype + đuôi file. | Không có |
| A09 | Security Logging and Monitoring Failures | `morgan('dev')` ghi log request; bảng `audit_logs` ghi lại các thao tác nghiệp vụ quan trọng (ai làm gì, lúc nào). Chưa có cảnh báo tự động khi phát hiện bất thường (ví dụ nhiều lần đăng nhập sai). | Ngoài phạm vi giai đoạn hiện tại; có thể bổ sung khi có hệ thống giám sát tập trung. |
| A10 | Server-Side Request Forgery (SSRF) | Backend không gọi ra URL do người dùng cung cấp. | Không áp dụng |

## Việc đã sửa trong lượt rà soát này

- Thêm rate limit cho `/auth/login` và `/auth/refresh` (A04/A07).

## Việc cần người vận hành làm khi triển khai

- Đặt `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `CORS_ORIGIN` bằng giá trị thật của môi
  trường, không dùng giá trị mặc định trong `backend/src/config.js`.
- Chạy sau một reverse proxy có HTTPS (Nginx/Caddy) — repo này chưa cấu hình HTTPS.
