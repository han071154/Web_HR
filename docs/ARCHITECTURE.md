# Kien Truc He Thong

## Tong quan

```text
React Frontend -> Express REST API -> PostgreSQL
       |                 |
       |                 +-> JWT auth, validation, business rules
       +-> Vite dev server
```

## Frontend

- Thu muc: `frontend/`
- Framework: ReactJS + Vite.
- Chuc nang hien co:
  - Login.
  - Dashboard nhan su.
  - Danh sach, tim kiem, loc nhan vien.
  - Them, sua, xoa nhan vien.

## Backend

- Thu muc: `backend/`
- Framework: Node.js + Express.
- Chuc nang hien co:
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `GET /api/departments`
  - `GET /api/employees`
  - `GET /api/employees/:id`
  - `POST /api/employees`
  - `PUT /api/employees/:id`
  - `DELETE /api/employees/:id`

## Database

- Thu muc: `database/`
- Bang hien co:
  - `users`
  - `departments`
  - `employees`

## CI

- File: `.github/workflows/ci.yml`
- Kiem tra:
  - `npm ci`
  - `npm run lint`
  - `npm run build`
