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

A department that still has employees cannot be deleted: `DELETE` returns `409`
`Department still has employees`. Move the employees to another department first.

## Employees

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/employees?search=&status=` | Any authenticated role |
| GET | `/employees/:id` | Any authenticated role |
| POST | `/employees` | ADMIN, HR_MANAGER, HR_STAFF |
| PUT | `/employees/:id` | ADMIN, HR_MANAGER, HR_STAFF |
| DELETE | `/employees/:id` | ADMIN, HR_MANAGER |

Create fields (`PUT` accepts any subset):

```json
{
  "employeeCode": "NV003",
  "fullName": "Nguyễn Văn An",
  "email": "an.nv@webhr.local",
  "phone": "0901234567",
  "gender": "MALE",
  "dateOfBirth": "2000-05-20",
  "departmentId": "department-uuid-or-null",
  "positionId": "position-uuid-or-null",
  "position": "Backend Developer",
  "employmentType": "FULL_TIME",
  "status": "ACTIVE",
  "hireDate": "2026-10-01",
  "baseSalary": 15000000,
  "address": "Optional address"
}
```

- Send `positionId` (a position from `/positions`) or a free-text `position`; one of them is required
  when creating. With `positionId`, the stored `position` name is taken from the position catalog.
- Renaming a position updates `position` on every employee linked to it. Deleting a position keeps
  the name on employees and sets their `positionId` to `null`.
- Sending only a different `position` text on `PUT` unlinks the employee from the catalog.

Employment types (shared with job postings): `FULL_TIME`, `PART_TIME`, `SHIFT`, `CONTRACT`, `INTERN`.

Employee statuses: `ACTIVE`, `ON_LEAVE`, `RESIGNED`, `TERMINATED`.

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

Rules:

- `INDEFINITE` contracts must not have an `endDate`; `PROBATION`, `FIXED_TERM` and `SEASONAL`
  contracts require one (`400 Validation error` on `endDate`).
- `endDate` must be on or after `startDate`.
- An employee can only have one `ACTIVE` contract. Creating or updating another one returns
  `409 Employee already has an active contract`; set the old contract to `EXPIRED` or
  `TERMINATED` first.

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

Job employment types use the same list as employees: `FULL_TIME`, `PART_TIME`, `SHIFT`, `CONTRACT`, `INTERN`.
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

## Job postings (HR)

Manage the postings shown on the public careers page. Only `OPEN` postings whose deadline has
not passed appear publicly.

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/jobs?search=&status=&departmentId=` | Any authenticated role |
| GET | `/jobs/:id` | Any authenticated role |
| POST | `/jobs` | ADMIN, HR_MANAGER, HR_STAFF |
| PUT | `/jobs/:id` | ADMIN, HR_MANAGER, HR_STAFF |
| DELETE | `/jobs/:id` | ADMIN, HR_MANAGER |

Create fields (`PUT` accepts any subset):

```json
{
  "code": "JOB-ACC-02",
  "title": "Nhân viên Kế toán",
  "departmentId": "department-uuid-or-null",
  "employmentType": "FULL_TIME",
  "quantity": 2,
  "salaryMin": 10000000,
  "salaryMax": 15000000,
  "experience": "Từ 1 năm",
  "location": "123 Nguyễn Văn Linh, Quận 7",
  "workingTime": "Thứ 2 – Thứ 6, 8:00 – 17:00",
  "description": "At least 10 characters, one item per line",
  "requirements": "Optional",
  "benefits": "Optional",
  "deadline": "2026-10-31",
  "status": "DRAFT"
}
```

- `code` is stored in uppercase and must be unique (`409 Job posting code already exists`).
- `status`: `DRAFT`, `OPEN`, `CLOSED`. `salaryMin`/`salaryMax`/`deadline` accept `null`;
  `salaryMax` must be greater than or equal to `salaryMin`.
- Responses add `isOpen`, `applicationCount` and `newApplicationCount`.
- A posting that already has applications cannot be deleted: `409 Job posting still has applications`.
  Set `status` to `CLOSED` instead.

## Applications (HR)

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/applications?jobId=&status=&search=` | Any authenticated role |
| GET | `/applications/:id` | Any authenticated role |
| GET | `/applications/:id/cv` | Any authenticated role (returns the PDF file) |
| PATCH | `/applications/:id` | ADMIN, HR_MANAGER, HR_STAFF |
| POST | `/applications/:id/hire` | ADMIN, HR_MANAGER, HR_STAFF |

`search` matches name, email, phone or application code (`HS-000123` or `123`).

Statuses: `NEW` → `REVIEWING` → `INTERVIEW` → `HIRED` or `REJECTED`.

`PATCH` fields (all optional):

```json
{
  "status": "INTERVIEW",
  "interviewAt": "2026-10-10T09:00:00+07:00",
  "note": "CV phù hợp, hẹn phỏng vấn vòng 1"
}
```

- `status` accepts `NEW`, `REVIEWING`, `INTERVIEW`, `REJECTED`. `HIRED` is only set by `/hire`.
- `interviewAt` must include a time zone (ISO 8601). `note` and `interviewAt` accept `null`.
- A hired application cannot change status (`409 Hired application status cannot be changed`).

`POST /applications/:id/hire` creates an employee from the application (name, email, phone) and
marks the application `HIRED` in one transaction:

```json
{
  "employeeCode": "NV010",
  "hireDate": "2026-10-15",
  "baseSalary": 9000000,
  "departmentId": "optional, defaults to the job's department",
  "positionId": "optional, defaults to the job title as position name",
  "employmentType": "optional, defaults to the job's employment type"
}
```

| Case | Status | Message |
| --- | --- | --- |
| Application already hired | 409 | `Application has already been hired` |
| Application rejected | 409 | `Rejected application cannot be hired` |
| Employee code or email already used | 409 | `Employee code already exists` / `Employee email already exists` |

## Error behavior

- Validation errors return `400`.
- Missing or invalid authentication returns `401`.
- Insufficient role permissions return `403`.
- Missing records return `404`.
- Duplicate employee codes/emails and other unique values return `409`.
- Deleting a department that still has employees returns `409`.
- Oversized avatar or CV files return `413`.
- Too many public applications from one IP return `429`.

## Local verification

With PostgreSQL and the backend running:

```bash
npm run db:setup
npm run db:test-users
npm run test:smoke
```

The Postman collection in `tests/postman` can be run in Postman or with Newman:

```bash
npx newman run tests/postman/WebHR.postman_collection.json -e tests/postman/WebHR-local.postman_environment.json
```

GitHub Actions runs the same steps (job `api-tests`) against a PostgreSQL 16 service on every
push to `main`, `master`, `Dev`, `feature` and on pull requests.
