# Kiểm tra bảo mật cơ bản (OWASP Top 10) — module Nhân sự, Ca làm việc, Chấm công & Báo cáo

Rà soát nhanh backend (`backend/src`) theo OWASP Top 10 (2021). Mục tiêu là ghi lại hiện trạng,
không phải một lần kiểm thử xâm nhập đầy đủ.

## Tuần 6: module Ca làm việc / Chấm công / Nghỉ phép / Báo cáo

- **A01 Broken Access Control**: route tự-phục vụ (`/work-schedules/me*`, `/attendance-records/check-in`,
  `/check-out`, `/attendance-records/me`, `/leave-requests/me`, `POST /leave-requests`) đều resolve
  `employeeId` từ `users.employee_id` của chính JWT (`getOwnEmployeeId`), không nhận `employeeId` từ
  body/query — nhân viên không thể chấm công hay xin nghỉ hộ người khác. Yêu cầu đổi ca kiểm tra
  `schedule.employee_id === employeeId` trước khi cho tạo (`403` nếu không phải lịch của chính mình).
  Các route quản trị (`/work-shifts`, `/work-schedules` CRUD, `/attendance-records` list/sửa,
  `/leave-requests` duyệt, `/reports/*`) đều có `requireRole(ADMIN, HR_MANAGER, HR_STAFF)`.
- **A03 Injection**: toàn bộ truy vấn mới dùng tham số hóa (`$1, $2, ...`), kể cả các câu
  `generate_series`/`EXTRACT` dùng trong `workHourStats.js` và duyệt nghỉ phép.
- **A04 Insecure Design**: giới hạn tổng giờ làm/tuần (`MAX_WEEKLY_WORK_HOURS`, mặc định 48h) được
  kiểm tra ở tầng ứng dụng trước khi ghi DB (`ensureWeeklyHourLimit`), tránh xếp ca vượt luật lao
  động. Trùng ca/ngày được chặn bằng cả kiểm tra ứng dụng lẫn unique index ở DB (hai lớp phòng thủ).
- **A09 Security Logging**: các thao tác quan trọng (tạo/duyệt lịch, check-in/out, duyệt nghỉ phép,
  duyệt đổi ca) đều ghi `audit_logs` qua `logAudit` với `entityType` riêng (`WORK_SCHEDULE`,
  `ATTENDANCE`, `LEAVE_REQUEST`, `SHIFT_CHANGE_REQUEST`).
- **Hạn chế đã biết**: chưa có hệ thống thông báo (notification) thật — kết quả duyệt đổi ca chỉ
  nằm trong audit log, nhân viên phải tự kiểm tra lại lịch/ trạng thái yêu cầu.

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

## Tuần 7: Docker hoá & triển khai

- **A02 Cryptographic Failures**: `docker-compose.yml` đọc `JWT_SECRET`/`JWT_REFRESH_SECRET` từ
  biến môi trường host (`${JWT_SECRET:-...}`), không hard-code secret thật trong file compose hay
  trong image. `.env` (nơi chứa secret thật) nằm trong `.gitignore`; chỉ `.env.example` (placeholder)
  được commit.
- **A05 Security Misconfiguration**: `frontend/nginx.conf` chỉ expose `/`, `/api/` (proxy sang
  backend) và `/uploads/` — không serve thư mục nguồn hay file cấu hình. Container backend chạy
  bằng user mặc định của image `node:22-alpine` (không phải root tùy chỉnh thêm, nhưng cũng không
  hạ quyền thủ công — xem mục "Việc cần làm" bên dưới nếu cần siết chặt thêm).
- **A06 Vulnerable Components**: `.github/workflows/ci.yml` build lại Docker image mỗi lần CI chạy
  (job `docker-build`), dùng base image cố định phiên bản (`node:22-alpine`, `nginx:1.27-alpine`)
  thay vì `latest` để tránh thay đổi bất ngờ không kiểm soát.
- **Việc cần làm trước khi bàn giao/deploy thật**: xem checklist đầy đủ ở `docs/DEPLOYMENT.md`
  mục 8 (đổi secret, cấu hình CORS theo domain thật, chạy sau HTTPS reverse proxy).

## Việc đã sửa trong lượt rà soát này

- Thêm rate limit cho `/auth/login` và `/auth/refresh` (A04/A07).

## Việc cần người vận hành làm khi triển khai

- Đặt `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `CORS_ORIGIN` bằng giá trị thật của môi
  trường, không dùng giá trị mặc định trong `backend/src/config.js`.
- Chạy sau một reverse proxy có HTTPS (Nginx/Caddy) — repo này chưa cấu hình HTTPS.
