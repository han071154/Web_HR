# Kien Truc He Thong

## Tong quan

```text
React Frontend (Vite) -> Express REST API -> PostgreSQL
       |                        |
       |                        +-> JWT auth, phan quyen theo vai tro, validation (zod)
       |                        +-> Upload file: avatar (public), CV ung vien (khong public)
       +-> Trang tuyen dung cong khai (khong can dang nhap)
       +-> Trang quan tri nhan su (can dang nhap)
```

Chi tiet tung API: xem [API.md](API.md).

## Frontend

- Thu muc: `frontend/`
- Framework: ReactJS + Vite. Dieu huong bang hash tren URL.
- Trang tuyen dung cong khai (`#/`, `#/viec-lam`, `#/viec-lam/<id>`, `#/viec-lam/<id>/ung-tuyen`):
  - Danh sach tin tuyen dung, tim kiem, loc theo phong ban va hinh thuc lam viec.
  - Chi tiet tin, nop ho so kem CV PDF.
- Trang quan tri (`#login`, `#employees`, `#departments`, `#positions`, `#contracts`, `#recruitment`):
  - Dang nhap, ghi nho dang nhap, tu dang xuat khi token het han.
  - Nhan su: danh sach, tim kiem, loc, phan trang, chi tiet (kem hop dong va lich su thay doi), them/sua (CCCD, quan ly truc tiep), vo hieu hoa, xoa, avatar.
  - Phong ban va chuc vu: them, sua, xoa.
  - Hop dong: danh sach toan cong ty, nhac hop dong sap het han; them/sua/xoa ngay tren trang chi tiet nhan vien.
  - Tuyen dung (Figma M-08a–e): quan ly tin (trang dang tin rieng, dong/mo lai), danh sach ho so (chip trang thai,
    danh dau chua xem), trang chi tiet ho so (xem truoc CV, tien trinh, lich su), chuyen ung vien Dau thanh nhan su
    kem hop dong dau tien.
- File dung chung: `api.js` (goi API), `format.js` (nhan tieng Viet, dinh dang ngay/tien),
  `messages.js` (dich loi tu backend sang tieng Viet).

## Backend

- Thu muc: `backend/`
- Framework: Node.js + Express 5.
- Nhom API (tien to `/api`):

| Nhom | Duong dan | Dang nhap |
| --- | --- | --- |
| Xac thuc | `/auth/login`, `/auth/me` | Khong / Co |
| Phong ban | `/departments` | Co |
| Chuc vu | `/positions` | Co |
| Nhan vien | `/employees`, `/employees/:id/avatar` | Co |
| Hop dong lao dong | `/contracts` | Co |
| Tuyen dung cong khai | `/public/jobs`, `/public/jobs/:id/applications` | Khong |
| Quan ly tin tuyen dung | `/jobs` | Co |
| Ho so ung vien | `/applications`, `/applications/:id/cv`, `/applications/:id/convert` | Co |

- Vai tro: `ADMIN`, `HR_MANAGER`, `HR_STAFF` (middleware `requireAuth`, `requireRole`).
- Danh sach hinh thuc lam viec dung chung: `backend/src/constants.js`.

## Database

- Thu muc: `database/` (`schema.sql` tao bang, `seed.sql` du lieu mau). Chay `npm run db:setup`.
- Cac bang:

| Bang | Noi dung | Lien ket chinh |
| --- | --- | --- |
| `users` | Tai khoan dang nhap va vai tro | |
| `departments` | Phong ban | |
| `positions` | Danh muc chuc vu | `department_id` -> `departments` |
| `employees` | Ho so nhan vien | `department_id` -> `departments`, `position_id` -> `positions` |
| `employment_contracts` | Hop dong lao dong | `employee_id` -> `employees` (xoa nhan vien thi xoa hop dong) |
| `job_postings` | Tin tuyen dung (`DRAFT`, `OPEN`, `CLOSED`) | `department_id` -> `departments` |
| `applications` | Ho so ung vien nop tu trang tuyen dung | `job_posting_id` -> `job_postings`, `employee_id` -> `employees` |
| `audit_logs` | Lich su thay doi (ai lam gi, luc nao) cua nhan vien va ho so ung vien | `entity_type` + `entity_id` |

- Quy tac du lieu:
  - Khong xoa duoc phong ban con nhan vien (API tra `409`).
  - `employees.position` luu ten chuc vu; doi ten chuc vu thi API cap nhat ten tren ho so nhan vien.
  - Moi nhan vien chi co mot hop dong dang hieu luc; hop dong khong thoi han thi khong co ngay ket thuc.
  - Moi email chi co mot ho so dang xu ly cho moi tin tuyen dung (unique index, tru ho so `REJECTED`).

## Kiem thu

- `npm run test:smoke`: smoke test API (`backend/scripts/smokeTest.js`).
- `tests/postman`: bo Postman (dang nhap, CRUD nhan su, phan quyen), chay bang Postman hoac Newman.

## CI

- File: `.github/workflows/ci.yml`. Chay khi push len `main`, `master`, `Dev`, `feature` va khi tao pull request.
- Job `build`: `npm ci`, `npm run lint`, `npm run build`.
- Job `api-tests`: PostgreSQL 16 -> `db:setup` + `db:test-users` -> chay backend -> smoke test -> Postman (Newman).
