# Web HR API

Base URL: `http://localhost:4000/api`

All routes except login, health and `/public/*` require `Authorization: Bearer <token>`.
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

## Public recruitment (no login)

Used by the public careers page (`/#/viec-lam`). No `Authorization` header is needed.
Only job postings with status `OPEN` and a deadline that has not passed are listed.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/public/jobs` | Open job postings. Query: `search` (title), `departmentId`, `employmentType` |
| GET | `/public/jobs/:id` | Job detail. Closed or expired jobs return `isOpen: false`; drafts return `404` |
| POST | `/public/jobs/:id/applications` | Submit an application (`multipart/form-data`) |

Job employment types: `FULL_TIME`, `PART_TIME`, `SHIFT`, `INTERN`.
`salaryMin`/`salaryMax` are `null` when the salary is negotiable.

Application form fields:

| Field | Rule |
| --- | --- |
| `fullName` | Required, 2–160 characters |
| `email` | Required, valid email (stored in lowercase; used as the login email if hired) |
| `phone` | Required, 10 digits starting with `0` (spaces, dots and dashes are removed) |
| `coverLetter` | Optional, up to 3000 characters |
| `consent` | Required, must be `true` |
| `cv` | Required file, real PDF (checked by content), up to 5 MB |

Success returns `201`:

```json
{
  "data": {
    "applicationCode": "HS-000123",
    "status": "NEW",
    "jobId": "uuid",
    "jobTitle": "Nhân viên Kế toán",
    "fullName": "Nguyễn Văn An",
    "email": "an.nv@gmail.com",
    "createdAt": "2026-09-30T08:00:00.000Z"
  }
}
```

| Case | Status | Message |
| --- | --- | --- |
| Invalid field | 400 | `Validation error` (+ `details`) |
| No CV file | 400 | `CV file is required` |
| CV is not a PDF | 400 | `CV must be a PDF file` |
| CV larger than 5 MB | 413 | `CV must not exceed 5 MB` |
| Job does not exist or is a draft | 404 | `Job posting not found` |
| Job closed or past deadline | 409 | `Job posting is closed` |
| Same email already has an application in progress for this job | 409 | `You have already applied for this job` |
| More than 10 applications per hour from one IP | 429 | `Too many applications, please try again later` |

An email can apply again for the same job only after the previous application was `REJECTED`.
CV files are stored in `backend/storage/cvs` (`CV_UPLOAD_DIR`), which is not served publicly.

## Error behavior

- Validation errors return `400`.
- Missing or invalid authentication returns `401`.
- Insufficient role permissions return `403`.
- Missing records return `404`.
- Duplicate employee codes/emails and other unique values return `409`.
- Oversized avatar or CV files return `413`.
- Too many public applications from one IP return `429`.

## Local verification

With PostgreSQL and the backend running:

```bash
npm run db:setup
npm run test:smoke
```
