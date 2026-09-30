# Web HR

Web HR is an HR management project scaffold for the first implementation sprints.

## Tech Stack

- Frontend: ReactJS + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- DevOps: Docker Compose + GitHub Actions

## Quick Start

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

Backend database settings are read from `backend/.env`. Copy `backend/.env.example`
and update `DATABASE_URL` when PostgreSQL runs outside the provided Docker Compose setup.

API reference: [docs/API.md](docs/API.md)

## Project Structure

```text
backend/              Express API, authentication, employee CRUD
frontend/             React HR interface
database/             PostgreSQL schema and seed data
.github/workflows/    CI checks
```

## Sprint Scope

- Sprint 1: project outline, initial backlog, development setup
- Sprint 2: architecture, database design, UI direction, CI baseline
- Sprint 3: authentication, authorization, employee profile API, HR interface
- Sprint 4: employee module completion, testing, seed data, documentation
