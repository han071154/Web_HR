# Hướng dẫn triển khai (Deployment Guide)

Repo chưa có server staging/production thật hay thông tin đăng nhập (credentials) để CI/CD tự
động deploy — `.github/workflows/ci.yml` chỉ build & validate 2 Docker image (`docker-build` job)
trên máy chạy CI, không push lên registry nào và không gọi tới server nào. Hướng dẫn dưới đây là
các bước triển khai **thủ công** lên một server (VPS/máy ảo) đã cài sẵn Docker + Docker Compose.

## 1. Chuẩn bị server

- Cài Docker Engine và Docker Compose plugin (`docker compose version` chạy được).
- Mở port cho `FRONTEND_PORT` (mặc định `8080`) và tuỳ chọn `BACKEND_PORT` (mặc định `4000`,
  không bắt buộc mở ra ngoài nếu frontend luôn gọi qua Nginx reverse proxy nội bộ).

## 2. Lấy mã nguồn và cấu hình

```bash
git clone <repository-url> web-hr
cd web-hr
git checkout <branch-hoac-tag-muon-deploy>

cp .env.example .env
# Sửa .env: bắt buộc đổi JWT_SECRET, JWT_REFRESH_SECRET; sửa CORS_ORIGIN nếu dùng domain riêng.
```

`.env` không được commit lên git (đã có trong `.gitignore`).

## 3. Build & chạy

```bash
docker compose up -d --build
docker compose ps        # cả 3 service (db, backend, frontend) phải "healthy"/"running"
```

Lần đầu triển khai (hoặc sau khi đổi schema), khởi tạo CSDL:

```bash
docker compose exec backend npm run db:setup
```

Kiểm tra nhanh:

```bash
curl -f http://localhost:${BACKEND_PORT:-4000}/api/health
curl -f http://localhost:${FRONTEND_PORT:-8080}/
```

## 4. Sao lưu trước khi deploy phiên bản mới

```bash
./scripts/backup-db.sh
# hoặc trực tiếp qua container đang chạy:
docker compose exec -T db pg_dump -U web_hr web_hr | gzip > backups/web_hr-$(date +%Y%m%d-%H%M%S).sql.gz
```

## 5. Cập nhật lên phiên bản mới

```bash
git pull
docker compose up -d --build
```

`schema.sql` dùng toàn `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
nên chạy lại `db:setup` luôn an toàn (idempotent), kể cả khi đã có dữ liệu.

## 6. Rollback khi có sự cố

```bash
./scripts/rollback.sh <git-ref-cu-da-biet-chay-on>
```

Script trên checkout lại mã nguồn cũ, build và khởi động lại container, rồi chờ `/api/health`.
Lưu ý: rollback mã nguồn **không** tự rollback schema/dữ liệu đã thay đổi — nếu phiên bản mới có
migration phá vỡ tương thích ngược, phải phục hồi từ bản sao lưu CSDL (bước 4) thủ công.

## 7. Giám sát log

- `docker compose logs -f backend` — log request (`morgan`) và lỗi ứng dụng.
- `docker compose logs -f db` — log PostgreSQL.
- Bảng `audit_logs` trong CSDL ghi lại các thao tác nghiệp vụ quan trọng (ai/khi nào/làm gì),
  xem qua `GET /employees/:id/history` hoặc truy vấn trực tiếp.

Hiện tại log chỉ ở `stdout` của container (mặc định Docker log driver); muốn giữ log lâu dài thì
cấu hình `logging.driver` trong `docker-compose.yml` (vd `json-file` với `max-size`/`max-file`)
hoặc chuyển sang một log collector tập trung — ngoài phạm vi repo này.

## 8. Checklist bảo mật trước khi bàn giao

Xem `docs/SECURITY_CHECKLIST.md`. Tối thiểu phải làm trước khi mở ra Internet:

- Đổi `JWT_SECRET`, `JWT_REFRESH_SECRET` sang giá trị ngẫu nhiên, không dùng giá trị mặc định.
- Đặt `CORS_ORIGIN` đúng domain thật (không để mặc định `localhost`).
- Chạy sau một reverse proxy có HTTPS (Nginx/Caddy/Cloudflare) — compose này tự phục vụ HTTP thuần
  ở cổng nội bộ, HTTPS termination ngoài phạm vi repo.
