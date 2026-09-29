# Web HR API

Base URL: `http://localhost:4000/api`

All routes except login and health require `Authorization: Bearer <token>`.
Successful resource responses use `{ "data": ... }`. PostgreSQL `DATE` fields are
returned as `YYYY-MM-DD` strings.

## Test accounts

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | `admin@webhr.local` | `admin123` |
| HR_MANAGER | `manager@webhr.local` | `manager123` |
| HR_STAFF | `staff@webhr.local` | `staff123` |

Run `npm run db:setup` to create or refresh these accounts.

## Departments

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/departments` | Any authenticated role |
| GET | `/departments/:id` | Any authenticated role |
| POST | `/departments` | ADMIN, HR_MANAGER |
| PUT | `/departments/:id` | ADMIN, HR_MANAGER |
| DELETE | `/departments/:id` | ADMIN, HR_MANAGER |

Create/update fields:

```json
{
  "name": "Engineering",
  "description": "Product engineering"
}
```

`description` accepts `null`. Department responses include `employeeCount`.

## Positions

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/positions?departmentId=&active=true` | Any authenticated role |
| GET | `/positions/:id` | Any authenticated role |
| POST | `/positions` | ADMIN, HR_MANAGER |
| PUT | `/positions/:id` | ADMIN, HR_MANAGER |
| DELETE | `/positions/:id` | ADMIN, HR_MANAGER |

Create/update fields:

```json
{
  "code": "BE-DEV",
  "name": "Backend Developer",
  "description": "Backend application developer",
  "departmentId": "department-uuid-or-null",
  "isActive": true
}
```

`description` and `departmentId` accept `null`.

## Employment contracts

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/contracts?employeeId=&status=&search=` | Any authenticated role |
| GET | `/contracts/:id` | Any authenticated role |
| POST | `/contracts` | ADMIN, HR_MANAGER, HR_STAFF |
| PUT | `/contracts/:id` | ADMIN, HR_MANAGER, HR_STAFF |
| DELETE | `/contracts/:id` | ADMIN, HR_MANAGER |

Create/update fields:

```json
{
  "contractNumber": "HDLD-EMP001-2026",
  "employeeId": "employee-uuid",
  "contractType": "FIXED_TERM",
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "signedDate": "2025-12-20",
  "salary": 20000000,
  "status": "ACTIVE",
  "notes": "Optional notes"
}
```

Contract types: `PROBATION`, `FIXED_TERM`, `INDEFINITE`, `SEASONAL`.

Contract statuses: `DRAFT`, `ACTIVE`, `EXPIRED`, `TERMINATED`.

`endDate`, `signedDate`, and `notes` accept `null`.

## Employee avatars

Upload an image with `multipart/form-data`. The form field name must be `avatar`.
JPEG, PNG, and WebP images up to 5 MB are accepted.

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/employees/:id/avatar` | ADMIN, HR_MANAGER, HR_STAFF |
| DELETE | `/employees/:id/avatar` | ADMIN, HR_MANAGER, HR_STAFF |

The upload response contains the updated employee and an absolute `avatarUrl`.
Employee list/detail responses also include `avatarUrl`.

Example frontend upload:

```js
const form = new FormData();
form.append('avatar', file);

await fetch(`${API_URL}/employees/${employeeId}/avatar`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form
});
```

Do not set `Content-Type` manually for `FormData`; the browser adds the boundary.

## Error behavior

- Validation errors return `400`.
- Missing or invalid authentication returns `401`.
- Insufficient role permissions return `403`.
- Missing records return `404`.
- Duplicate employee codes/emails and other unique values return `409`.
- Oversized avatar files return `413`.

## Local verification

With PostgreSQL and the backend running:

```bash
npm run db:setup
npm run test:smoke
```
