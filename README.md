# Web HR

Hệ thống quản lý nhân sự nội bộ: hồ sơ nhân viên, phòng ban – chức vụ, hợp đồng, tuyển dụng (trang
tuyển dụng công khai), ca làm việc, chấm công, nghỉ phép, thông báo, báo cáo (Excel/PDF) và quản lý
tài khoản.

## Tech Stack

- Frontend: ReactJS + Vite
- Backend: Node.js 22 + Express 5
- Database: PostgreSQL 16
- DevOps: Docker Compose + GitHub Actions (CI/CD)

## Yêu cầu

- Node.js 22+ và npm
- Docker Desktop / Docker Engine (để chạy PostgreSQL hoặc toàn bộ hệ thống)

## Quick Start (local dev)

1. Khởi động PostgreSQL:

```bash
docker compose up -d db
```

2. Cài dependency:

```bash
npm install
```

3. Tạo file môi trường (PowerShell/CMD dùng `copy`, bash dùng `cp`):

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

4. Tạo schema và dữ liệu mẫu (thêm `LOAD_SAMPLE_DATA=true` để nạp dữ liệu demo đầy đủ):

```bash
npm run db:setup
```

5. Chạy backend và frontend:

```bash
npm run dev
```

- Frontend: http://localhost:5173 (trang tuyển dụng công khai mở đầu tiên; nhân sự đăng nhập tại
  http://localhost:5173/#login)
- Backend health check: http://localhost:4000/api/health
- Swagger UI (toàn bộ API): http://localhost:4000/api/docs

Tài khoản mặc định:

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Admin | `admin@webhr.local` | `admin123` |
| HR Manager | `manager@webhr.local` | `manager123` |
| HR Staff | `staff@webhr.local` | `staff123` |
| Nhân viên (liên kết hồ sơ `EMP002`) | `employee@webhr.local` | `employee123` |

Đổi các mật khẩu này trước khi triển khai thật. Backend đọc cấu hình từ `backend/.env` (và
`backend/.env.local` nếu có, ưu tiên hơn); sửa `DATABASE_URL` khi PostgreSQL chạy nơi khác.

## Chạy toàn hệ thống bằng Docker Compose

Production/local (frontend http://localhost:8080):

```bash
copy .env.example .env
docker compose up -d --build
docker compose exec backend npm run db:setup
```

Staging (frontend http://localhost:8081, chạy song song với production, có sao lưu và tự rollback):

```bash
cp .env.staging.example .env.staging   # đổi các secret
./scripts/deploy.sh .env.staging
```

Chi tiết: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (staging, CI/CD, giám sát log, sao lưu/phục hồi, rollback).

## Lệnh thường dùng

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy backend (nodemon) + frontend (Vite) |
| `npm run lint` | ESLint backend + frontend |
| `npm test` | Unit test backend (Vitest, không cần CSDL) |
| `npm run build` | Build frontend |
| `npm run db:setup` | Tạo/cập nhật schema + dữ liệu mẫu (chạy lại an toàn) |
| `npm run db:test-users` | Tạo tài khoản test cho smoke test/Postman |
| `npm run test:smoke` | Smoke test API (cần backend + CSDL đang chạy) |
| `npm run docs:openapi --workspace backend` | Xuất spec OpenAPI ra `docs/openapi.json` |
| `./scripts/deploy.sh <env-file> [git-ref]` | Triển khai bằng Docker Compose |
| `./scripts/backup-all.sh` | Sao lưu CSDL + mã nguồn + file upload |
| `./scripts/rollback.sh <git-ref>` | Quay lại phiên bản cũ |
| `./scripts/package-release.sh <git-ref>` | Đóng gói mã nguồn bàn giao (.zip) |

## Cấu trúc thư mục

```text
backend/              Express API (src/routes, src/utils, src/openapi = tài liệu Swagger), scripts DB/smoke test
frontend/             Giao diện React (src/components = các màn hình), Dockerfile + nginx.conf
database/             schema.sql, seed.sql, sample-data.sql (dữ liệu demo)
docs/                 SRS, kiến trúc + ERD, API, openapi.json, triển khai, bảo mật, kiểm thử, backlog
scripts/              deploy, backup, rollback, đóng gói bàn giao
tests/postman/        Bộ Postman (chạy bằng Newman trên CI)
.github/workflows/    CI/CD: lint, unit test, build, Docker image, API test, deploy staging
```

## Tài liệu

- [SRS](docs/SRS.md): yêu cầu chức năng / phi chức năng, tiêu chí nghiệm thu
- [Kiến trúc & ERD](docs/ARCHITECTURE.md)
- [API](docs/API.md) và Swagger `/api/docs` ([openapi.json](docs/openapi.json))
- [Triển khai](docs/DEPLOYMENT.md), [Bảo mật](docs/SECURITY_CHECKLIST.md), [Kế hoạch kiểm thử](docs/TEST_PLAN.md), [Backlog](docs/BACKLOG.md)

## Bàn giao

- Mã nguồn: tag git có chú thích trên GitHub — `v1.0.0-rc.1` (bản ứng viên trên nhánh `feature`), gắn `v1.0.0`
  sau khi merge vào `master`; gói zip tạo bằng `./scripts/package-release.sh <tag>` (thư mục `dist-release/`).
- Dữ liệu: `./scripts/backup-all.sh` (CSDL + mã nguồn + file upload, kèm `SHA256SUMS`), cách phục hồi xem
  DEPLOYMENT mục 7.

## Sprint Scope

- Sprint 1: project outline, initial backlog, development setup
- Sprint 2: architecture, database design, UI direction, CI baseline
- Sprint 3: authentication, authorization, employee profile API, HR interface
- Sprint 4: employee module completion, testing, seed data, documentation
- Sprint 5: shift & schedule module (shift catalog, scheduling, self-registration, shift-change requests,
  notifications)
- Sprint 6: attendance (check-in/out, late/early/absent by shift), leave requests, reports (Excel/PDF), dashboard
- Sprint 7: Docker Compose deployment, CI/CD with staging deploy, logging & monitoring, backup & rollback
- Sprint 8: final docs (SRS/architecture + ERD/API + Swagger), backend cleanup, backup, release packaging & archive
