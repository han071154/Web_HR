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

## Auth

Interactive Swagger UI for this section is served at `/api/docs` (task #68).

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/auth/login` | None |
| POST | `/auth/refresh` | None (requires a valid `refreshToken`) |
| GET | `/auth/me` | Any authenticated role |

```json
// POST /auth/login
{ "email": "admin@webhr.local", "password": "admin123" }
```

```json
// 200 response
{
  "token": "access-token-jwt",
  "refreshToken": "refresh-token-jwt",
  "user": { "id": "uuid", "email": "admin@webhr.local", "fullName": "Web HR Admin", "role": "ADMIN" }
}
```

`token` (access token) expires after `JWT_EXPIRES_IN` (default `1d`). `refreshToken` expires after
`JWT_REFRESH_EXPIRES_IN` (default `30d`) and is only accepted by `POST /auth/refresh`:

```json
// POST /auth/refresh
{ "refreshToken": "refresh-token-jwt" }
```

```json
// 200 response
{ "token": "new-access-token-jwt" }
```

`401 Invalid or expired refresh token` is returned for an expired/forged/wrong-type token or a
deactivated account. `/auth/login` and `/auth/refresh` are rate-limited to 20 requests per 15
minutes per IP (`429 Too many login attempts, please try again later`).

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
| GET | `/employees?search=&status=&departmentId=&position=&page=&limit=` | Any authenticated role |
| GET | `/employees/lookup` | Any authenticated role |
| GET | `/employees/:id` | Any authenticated role |
| GET | `/employees/:id/history` | Any authenticated role |
| GET | `/employees/export?search=&status=&departmentId=&position=` | ADMIN, HR_MANAGER, HR_STAFF |
| POST | `/employees/import` | ADMIN, HR_MANAGER, HR_STAFF |
| POST | `/employees` | ADMIN, HR_MANAGER, HR_STAFF |
| PUT | `/employees/:id` | ADMIN, HR_MANAGER, HR_STAFF |
| DELETE | `/employees/:id` | ADMIN, HR_MANAGER |

BUG-06: `GET /employees` is paginated (`page` default `1`, `limit` default `20`, max `100`) and
returns a `pagination` block alongside `data`:

```json
{
  "data": [ /* up to `limit` employees for this page */ ],
  "pagination": { "page": 1, "limit": 20, "total": 5000, "totalPages": 250 }
}
```

`search` matches full name (accent-insensitive, via PostgreSQL `unaccent`), employee code or email.

`GET /employees/lookup` returns every employee with only `id`, `employeeCode`, `fullName`,
`position` and `status` (no department/manager join) — used by the frontend for the manager
picker, the "next employee code" suggestion and the free-text position filter without paying the
cost of the full paginated query for every employee.

### Import / export (Excel, HR-009)

`GET /employees/export` streams an `.xlsx` file (same filters as the list) with columns: Mã nhân
viên, Họ tên, Email, Điện thoại, Giới tính, Ngày sinh, CCCD, Phòng ban, Chức vụ, Hình thức làm
việc, Trạng thái, Ngày vào làm, Lương cơ bản, Địa chỉ.

`POST /employees/import` accepts `multipart/form-data` with a `file` field (`.xlsx`, up to 10 MB,
same columns as the export, header row required but columns can be reordered). An existing
`employeeCode` is updated; a new one is created. Department/position columns are matched by name
(case-insensitive) against the existing catalog; an unmatched position is kept as free text.

```json
// 200 response
{ "data": { "created": 12, "updated": 3, "skipped": 1, "errors": [{ "row": 7, "message": "Invalid email" }] } }
```

A row that fails validation is skipped (not the whole import) and reported in `errors` with its
1-based spreadsheet row number.

Create fields (`PUT` accepts any subset):

```json
{
  "employeeCode": "NV003",
  "fullName": "Nguyễn Văn An",
  "email": "an.nv@webhr.local",
  "phone": "0901234567",
  "gender": "MALE",
  "dateOfBirth": "2000-05-20",
  "idNumber": "079200001234",
  "departmentId": "department-uuid-or-null",
  "managerId": "employee-uuid-or-null",
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
- `idNumber` (CCCD) is optional, 9 or 12 digits and unique (`409 ID number already exists`).
- `managerId` is the direct manager (another employee, `400` if it is the employee itself).
  Responses include `managerName`.

`GET /employees/:id/history` returns the change history, newest first (up to 50):

```json
{
  "data": [
    {
      "id": "uuid",
      "action": "UPDATED",
      "details": { "fields": { "phone": { "from": "0901000002", "to": "0912345678" } } },
      "actorName": "Web HR Admin",
      "createdAt": "2026-10-02T03:56:00.000Z"
    }
  ]
}
```

Employee history actions: `CREATED`, `UPDATED`, `AVATAR_UPDATED`, `AVATAR_REMOVED`, `CONTRACT_ADDED`,
`CONTRACT_UPDATED`, `CONTRACT_DELETED`.

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
- An `OPEN` posting needs a deadline of today or later when it is created, opened or its deadline
  changes (`400 Deadline must be today or later to open a job posting`).
- A posting that already has applications cannot be deleted: `409 Job posting still has applications`.
  Set `status` to `CLOSED` instead.

## Applications (HR)

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/applications?jobId=&status=&search=` | Any authenticated role |
| GET | `/applications/:id` | Any authenticated role (adds `cvSize` and `history`) |
| GET | `/applications/:id/cv` | Any authenticated role (PDF; `?inline=1` to preview in the browser) |
| PATCH | `/applications/:id` | ADMIN, HR_MANAGER, HR_STAFF |
| POST | `/applications/:id/convert` | ADMIN, HR_MANAGER, HR_STAFF |
| DELETE | `/applications/:id` | ADMIN, HR_MANAGER |

`search` matches name, email, phone or application code (`HS-000123` or `123`).
Each application has `viewedAt`: `null` until HR opens `GET /applications/:id` for the first time.

Statuses (Figma M-08c): `NEW` (Mới nộp) → `REVIEWING` (Đang xét) → `INTERVIEW` (Phỏng vấn) →
`HIRED` (Đậu) or `REJECTED` (Trượt).

`PATCH` fields (all optional):

```json
{
  "status": "INTERVIEW",
  "interviewAt": "2026-10-10T09:00:00+07:00",
  "note": "CV phù hợp, hẹn phỏng vấn vòng 1"
}
```

- `INTERVIEW` needs an interview time (`400 Interview time is required for interview status`).
- `interviewAt` must include a time zone (ISO 8601). `note` and `interviewAt` accept `null`.
- After the application was converted into an employee its status cannot change
  (`409 Converted application status cannot be changed`).

`POST /applications/:id/convert` (M-08e) only works for a `HIRED` application. In one transaction it
creates the employee (name, email and phone from the application), the first `ACTIVE` contract
(`HDLD-<employeeCode>-<year>`) and links the application to the employee:

```json
{
  "employeeCode": "NV010",
  "hireDate": "2026-10-15",
  "baseSalary": 9000000,
  "contractType": "PROBATION",
  "contractEndDate": "2026-12-14",
  "departmentId": "optional, defaults to the job's department",
  "positionId": "optional, defaults to the job title as position name",
  "employmentType": "optional, defaults to the job's employment type"
}
```

`contractEndDate` is required (and on or after `hireDate`) unless `contractType` is `INDEFINITE`.

| Case | Status | Message |
| --- | --- | --- |
| Application is not `HIRED` | 409 | `Only passed applications can be converted` |
| Application already converted | 409 | `Application has already been converted` |
| Employee code or email already used | 409 | `Employee code already exists` / `Employee email already exists` |

Application history actions: `SUBMITTED`, `STATUS_CHANGED`, `INTERVIEW_SCHEDULED`, `NOTE_UPDATED`, `CONVERTED`.

BUG-05: `DELETE /applications/:id` removes the application, its history and its CV file. An
application already converted into an employee cannot be deleted
(`409 Cannot delete an application that has already been converted to an employee`) since it is
the source record for that employee's first contract.

## Error behavior

- Validation errors return `400`.
- Missing or invalid authentication returns `401`.
- Insufficient role permissions return `403`.
- Missing records return `404`.
- Duplicate employee codes/emails and other unique values return `409`.
- Deleting a department or a position that still has employees returns `409`.
- Oversized avatar, CV or Excel import files return `413`.
- Too many public applications from one IP, or too many login/refresh attempts, return `429`.

## Local verification

Unit tests (mock the database, no PostgreSQL needed — task #67, currently covers `/auth`):

```bash
npm run test --workspace backend
```

Integration checks, with PostgreSQL and the backend running:

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
