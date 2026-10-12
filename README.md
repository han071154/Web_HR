# Web HR

Web HR is an HR management project scaffold for the first implementation sprints.

## Tech Stack

- Frontend: ReactJS + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- DevOps: Docker Compose + GitHub Actions

## Quick Start (local dev)

1. Start PostgreSQL:

```bash
docker compose up -d db
```

2. Install dependencies:

```bash
npm install
```

3. Copy environment files:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

4. Run database migration and seed data:

```bash
npm run db:setup
```

5. Start backend and frontend:

```bash
npm run dev
```

Frontend: http://localhost:5173 (the public careers page opens first; staff sign in at
http://localhost:5173/#login)

Backend health check: http://localhost:4000/api/health

Default login:

- Email: `admin@webhr.local`
- Password: `admin123`

Test role accounts:

- HR Manager: `manager@webhr.local` / `manager123`
- HR Staff: `staff@webhr.local` / `staff123`
- Employee (self-service, linked to employee `EMP002`): `employee@webhr.local` / `employee123`

Backend database settings are read from `backend/.env`. Copy `backend/.env.example`
and update `DATABASE_URL` when PostgreSQL runs outside the provided Docker Compose setup.

API reference: [docs/API.md](docs/API.md)

## Quick Start (full stack with Docker Compose)

Runs `db` + `backend` + `frontend` (built from their Dockerfiles) in one command — see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full deployment/rollback guide.

```bash
copy .env.example .env
docker compose up -d --build
docker compose exec backend npm run db:setup
```

- Frontend: http://localhost:8080
- Backend health check: http://localhost:4000/api/health (or the `BACKEND_PORT` you set in `.env`)

## Project Structure

```text
backend/              Express API: auth, employees, shifts/schedules, attendance, leave, reports
frontend/             React HR interface
database/             PostgreSQL schema and seed data
scripts/              Backup / rollback / release-packaging scripts (DevOps)
.github/workflows/    CI checks (lint, unit tests, Docker build, API smoke + Postman tests)
```

## Sprint Scope

- Sprint 1: project outline, initial backlog, development setup
- Sprint 2: architecture, database design, UI direction, CI baseline
- Sprint 3: authentication, authorization, employee profile API, HR interface
- Sprint 4: employee module completion, testing, seed data, documentation
- Sprint 5: shift & schedule module (shift catalog, scheduling, self-registration, shift-change
  requests)
- Sprint 6: attendance (check-in/out), leave requests, department/work-hour reports
- Sprint 7: Dockerized backend/frontend, CI Docker build, deployment & rollback guide
- Sprint 8: final docs (SRS/architecture/API), backend cleanup, release packaging
