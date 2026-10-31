# Hướng dẫn triển khai (Deployment Guide)

Hệ thống chạy bằng Docker Compose gồm 3 service: `db` (PostgreSQL 16), `backend` (Node.js 22) và
`frontend` (Nginx phục vụ bản build React, proxy `/api`). Staging và production dùng chung
`docker-compose.yml`, chỉ khác env file và tên project nên chạy song song được trên cùng máy chủ.

| Môi trường | Env file | Project | Frontend | Backend | DB (host) |
| --- | --- | --- | --- | --- | --- |
| Staging | `.env.staging` (mẫu `.env.staging.example`) | `web-hr-staging` | 8081 | 4001 | 5433 |
| Production | `.env` (mẫu `.env.example`) | thư mục repo | 8080 | 4000 | 5432 |

## 1. Chuẩn bị máy chủ

- Docker Engine + Docker Compose plugin (`docker compose version` chạy được), `git`, `curl`.
- Mở cổng frontend (8080/8081). Cổng backend và DB không bắt buộc mở ra ngoài: frontend gọi backend
  qua Nginx trong mạng nội bộ của compose.

## 2. Lấy mã nguồn và cấu hình

```bash
git clone <repository-url> web-hr
cd web-hr
cp .env.staging.example .env.staging   # hoặc: cp .env.example .env (production)
```

Sửa env file: **bắt buộc** đổi `JWT_SECRET`, `JWT_REFRESH_SECRET`, `POSTGRES_PASSWORD` sang chuỗi ngẫu
nhiên (`openssl rand -hex 32`); sửa `CORS_ORIGIN` theo domain thật. `.env`, `.env.staging`,
`.env.production` đã nằm trong `.gitignore`, không commit lên git.

## 3. Triển khai bằng script (khuyến nghị)

```bash
./scripts/deploy.sh .env.staging              # deploy mã nguồn đang checkout
./scripts/deploy.sh .env.staging origin/Dev   # checkout rồi deploy một nhánh/tag/commit
```

Script thực hiện:

1. Sao lưu CSDL đang chạy vào `backups/<project>/web_hr-<timestamp>.sql.gz` (bỏ qua ở lần đầu).
2. (Tùy chọn) `git checkout` ref được chỉ định.
3. `docker compose up -d --build` → `npm run db:setup` trong container backend (schema idempotent; nạp
   dữ liệu demo nếu `LOAD_SAMPLE_DATA=true`, chỉ dùng cho staging).
4. Chờ `GET /api/health` (backend + CSDL) và trang frontend trả 200, tối đa 120 giây.
5. Bước nào lỗi → tự checkout lại commit trước đó, build và chạy lại (rollback mã nguồn).

Kiểm tra sau triển khai:

```bash
docker compose --env-file .env.staging -p web-hr-staging ps    # 3 service "healthy"
curl -f http://localhost:4001/api/health
API_URL=http://localhost:4001/api DATABASE_URL=postgres://web_hr:<POSTGRES_PASSWORD>@localhost:5433/web_hr npm run test:smoke
npx newman run tests/postman/WebHR.postman_collection.json -e tests/postman/WebHR-local.postman_environment.json --env-var baseUrl=http://localhost:4001/api
```

Smoke test cần tài khoản test: `docker compose ... exec backend npm run db:test-users`. Lưu ý giới hạn đăng
nhập (20 lần/15 phút/IP): chạy smoke test và Postman liên tiếp thì khởi động lại backend ở giữa
(`docker compose ... restart backend`).

## 4. CI/CD (GitHub Actions)

`.github/workflows/ci.yml` chạy mỗi lần push/pull request:

| Job | Nội dung |
| --- | --- |
| `build` | `npm ci`, lint, unit test, build frontend, kiểm tra `docs/openapi.json` khớp code |
| `docker-build` | Build image backend + frontend |
| `api-tests` | PostgreSQL thật → `db:setup` + `db:test-users` → smoke test → Postman (Newman) |
| `deploy-staging` | Push vào `Dev` (hoặc bấm **Run workflow**), sau khi 3 job trên qua: SSH vào máy staging, chạy `./scripts/deploy.sh .env.staging <commit>` |

Cấu hình một lần trong **Settings → Secrets and variables → Actions**:

| Secret | Giá trị |
| --- | --- |
| `STAGING_HOST` | IP/domain máy staging |
| `STAGING_USER` | User SSH (có quyền chạy docker) |
| `STAGING_SSH_KEY` | Private key SSH (public key đặt trong `~/.ssh/authorized_keys` của user trên) |
| `STAGING_PATH` | Đường dẫn thư mục repo trên máy staging (đã có `.env.staging`) |

Chưa cấu hình `STAGING_HOST` thì job deploy ghi chú và bỏ qua, pipeline vẫn xanh.

## 5. Giám sát log

- Backend ghi log JSON một dòng/sự kiện (`LOG_FORMAT=json`, mặc định trong compose): mỗi request có `requestId`
  (trả về ở header `X-Request-Id`), method, path, status, `durationMs`, `userId`; lỗi 500 kèm stack trace.
  Health check không ghi log để tránh ngập.
- Xem log: `docker compose ... logs -f backend`; lọc lỗi: `docker compose ... logs --no-log-prefix backend | grep '"level":"error"'`.
- Log container dạng `json-file` xoay vòng 5 file × 10 MB mỗi service (không đầy ổ đĩa).
- Tùy chọn ghi thêm ra file: `LOG_FILE=logs/app.log` → `logs/app-YYYY-MM-DD.log`, giữ `LOG_RETENTION_DAYS` ngày.
- `LOG_LEVEL=debug|info|warn|error` để chỉnh độ chi tiết.
- Bảng `audit_logs` ghi các thao tác nghiệp vụ (ai/khi nào/làm gì).

## 6. Health check & tự phục hồi

- `GET /api/health` kiểm tra cả kết nối CSDL: `200 {status: 'ok', database: 'ok'}` hoặc
  `503 {status: 'degraded'}`. Docker dùng nó làm healthcheck của backend; frontend chỉ khởi động khi backend healthy.
- Mọi service `restart: unless-stopped`. Mất CSDL tạm thời không làm sập backend (trả 503, tự kết nối lại).
- Backend dừng êm khi nhận SIGTERM (`docker stop`, deploy): xử lý nốt request đang chạy rồi đóng kết nối CSDL.

## 7. Sao lưu & phục hồi

| Script | Dùng khi |
| --- | --- |
| `scripts/backup-all.sh` | Sao lưu toàn bộ: CSDL (`database.dump` + `database.sql.gz`), mã nguồn (`web-hr.bundle` mọi nhánh/tag), file upload/CV (`files.tar.gz`), `SHA256SUMS` |
| `scripts/backup-db.sh` | Chỉ CSDL, bằng `pg_dump` cài trên máy |
| `scripts/deploy.sh` | Tự sao lưu CSDL trước mỗi lần deploy |

```bash
ENV_FILE=.env.staging COMPOSE_PROJECT=web-hr-staging ./scripts/backup-all.sh   # CSDL trong docker compose
DATABASE_URL='postgres://user:pass@host:5432/db' ./scripts/backup-all.sh         # CSDL cloud (pg_dump chạy trong Docker)
```

Phục hồi:

```bash
cd backups/full-<timestamp> && sha256sum -c SHA256SUMS           # kiểm tra bản sao lưu
docker compose exec -T db pg_restore -U web_hr -d web_hr --clean --if-exists --no-owner < database.dump
git clone web-hr.bundle web-hr                                    # khôi phục mã nguồn
tar -xzf files.tar.gz                                             # khôi phục avatar/CV vào backend/
```

Thư mục `backups/` đã nằm trong `.gitignore`: bản sao lưu chứa dữ liệu cá nhân, chỉ lưu ở nơi an toàn.

## 8. Rollback

```bash
./scripts/rollback.sh <git-ref-cu-da-biet-chay-on>
```

Checkout lại mã nguồn cũ, build và khởi động lại, chờ `/api/health`. Rollback mã nguồn **không** rollback
dữ liệu: nếu bản mới đã đổi dữ liệu không tương thích, phục hồi CSDL từ bản sao lưu (mục 7).
`schema.sql` chỉ dùng `CREATE ... IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` nên bản cũ vẫn chạy được trên schema mới.

## 9. Đóng gói & lưu trữ bàn giao

```bash
./scripts/package-release.sh v1.0.0-rc.1 dist-release   # zip đúng nội dung đã commit tại tag (git archive)
```

Mỗi bản bàn giao được gắn tag git có chú thích trên GitHub (`v1.0.0-rc.1` cho bản ứng viên, `v1.0.0` sau khi
merge vào `master`); file zip, bản sao lưu đầy đủ (`backup-all.sh`) và checksum lưu kèm theo (xem README mục Bàn giao).

## 10. Checklist bảo mật trước khi mở ra Internet

Xem `docs/SECURITY_CHECKLIST.md`. Tối thiểu:

- Đổi `JWT_SECRET`, `JWT_REFRESH_SECRET`, `POSTGRES_PASSWORD`; không dùng giá trị mặc định.
- Đặt `CORS_ORIGIN` đúng domain thật.
- Chạy sau reverse proxy có HTTPS (Nginx/Caddy/Cloudflare); compose này phục vụ HTTP thuần ở cổng nội bộ.
- Không mở cổng DB (`DB_PORT`) ra Internet.
