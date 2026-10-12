CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- BUG-06: tìm nhân sự không phân biệt dấu tiếng Việt (unaccent(...) ILIKE unaccent(...)).
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'HR_STAFF',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code VARCHAR(40) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  phone VARCHAR(40),
  gender VARCHAR(20),
  date_of_birth DATE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  position VARCHAR(120) NOT NULL,
  employment_type VARCHAR(40) NOT NULL DEFAULT 'FULL_TIME',
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
  hire_date DATE NOT NULL,
  base_salary NUMERIC(14, 2) NOT NULL DEFAULT 0,
  address TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chức vụ của nhân viên liên kết với danh mục chức vụ. Cột employees.position vẫn giữ tên
-- chức vụ (đổi tên chức vụ thì API cập nhật theo; xóa chức vụ thì nhân viên giữ tên cũ).
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES positions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS employment_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number VARCHAR(60) NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  contract_type VARCHAR(40) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  signed_date DATE,
  salary NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_full_name ON employees(full_name);
CREATE INDEX IF NOT EXISTS idx_positions_department_id ON positions(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_position_id ON employees(position_id);
CREATE INDEX IF NOT EXISTS idx_contracts_employee_id ON employment_contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON employment_contracts(status);
-- Mỗi nhân viên chỉ có một hợp đồng đang hiệu lực (API cũng kiểm tra trước để báo lỗi rõ ràng).
CREATE UNIQUE INDEX IF NOT EXISTS employment_contracts_one_active_key
  ON employment_contracts (employee_id)
  WHERE status = 'ACTIVE';

-- Tuyển dụng: tin tuyển dụng công khai và hồ sơ ứng viên nộp từ trang /#/viec-lam.
CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(40) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  employment_type VARCHAR(40) NOT NULL DEFAULT 'FULL_TIME',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  salary_min NUMERIC(14, 2),
  salary_max NUMERIC(14, 2),
  experience VARCHAR(120),
  location VARCHAR(255),
  working_time VARCHAR(255),
  description TEXT NOT NULL,
  requirements TEXT,
  benefits TEXT,
  deadline DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_no BIGSERIAL NOT NULL UNIQUE,
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE RESTRICT,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  cv_path TEXT NOT NULL,
  cv_original_name VARCHAR(255),
  cover_letter TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'NEW'
    CHECK (status IN ('NEW', 'REVIEWING', 'INTERVIEW', 'HIRED', 'REJECTED')),
  note TEXT,
  interview_at TIMESTAMPTZ,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_applications_job_posting_id ON applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
-- Một email chỉ có một hồ sơ đang xử lý cho mỗi tin; bị trượt thì được nộp lại.
CREATE UNIQUE INDEX IF NOT EXISTS applications_active_email_job_key
  ON applications (job_posting_id, LOWER(email))
  WHERE status <> 'REJECTED';

-- M-03a: số CCCD và quản lý trực tiếp của nhân viên.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS id_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES employees(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employees_id_number_key
  ON employees (id_number)
  WHERE id_number IS NOT NULL;

-- M-08c: thời điểm HR mở xem hồ sơ lần đầu (NULL = hồ sơ chưa xem, hiện chấm xanh).
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

-- Nhật ký thay đổi (thẻ "Lịch sử" ở M-03a và M-08d): ai làm gì, lúc nào.
-- details lưu chi tiết dạng JSON, ví dụ {"fields": {"phone": {"from": "...", "to": "..."}}}.
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(40) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at DESC);

-- Tai khoan tu-phuc-vu cua nhan vien (cham cong, xem lich ca nhan, xin nghi phep, dang ky/doi ca):
-- lien ket 1-1 toi employees qua employee_id (null = tai khoan HR thuan, khong phai nhan vien).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_employee_id_key
  ON users (employee_id)
  WHERE employee_id IS NOT NULL;

-- Ca lam viec & cham cong/nghi phep (HR-021, HR-022, HR-023): module Tuan 5-6 (Ca lam viec,
-- Cham cong & nghi phep, Bao cao thong ke).
CREATE TABLE IF NOT EXISTS work_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lich phan ca: moi nhan vien chi co mot ca cho moi ngay lam viec.
CREATE TABLE IF NOT EXISTS work_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES work_shifts(id) ON DELETE RESTRICT,
  work_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CANCELLED')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, work_date)
);

-- Cham cong theo ngay, doi chieu voi lich phan ca (schedule_id co the null neu cham cong ngoai lich).
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES work_schedules(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'PRESENT'
    CHECK (status IN ('PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, work_date)
);

-- Don nghi phep: quan ly duyet/tu choi theo nguoi dung (users).
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(20) NOT NULL CHECK (leave_type IN ('ANNUAL', 'SICK', 'UNPAID', 'OTHER')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Yeu cau doi ca: nhan vien de xuat doi lich phan ca sang ca khac, HR duyet/tu choi.
CREATE TABLE IF NOT EXISTS shift_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
  requested_shift_id UUID REFERENCES work_shifts(id) ON DELETE SET NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_schedules_employee_date ON work_schedules(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_work_schedules_shift_id ON work_schedules(shift_id);
CREATE INDEX IF NOT EXISTS idx_work_schedules_work_date ON work_schedules(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_date ON attendance_records(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_work_date ON attendance_records(work_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_shift_change_requests_employee_id ON shift_change_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_change_requests_schedule_id ON shift_change_requests(schedule_id);
CREATE INDEX IF NOT EXISTS idx_shift_change_requests_status ON shift_change_requests(status);
