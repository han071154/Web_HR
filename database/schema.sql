CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
