INSERT INTO departments (name, description)
VALUES
  ('Human Resources', 'People operations and employee services'),
  ('Engineering', 'Product engineering and platform development'),
  ('Finance', 'Accounting, payroll, and reporting')
ON CONFLICT (name) DO NOTHING;

INSERT INTO employees (
  employee_code,
  full_name,
  email,
  phone,
  gender,
  date_of_birth,
  department_id,
  position,
  employment_type,
  status,
  hire_date,
  base_salary,
  address
)
SELECT
  'EMP001',
  'Nguyen Minh Anh',
  'minhanh@webhr.local',
  '0901000001',
  'FEMALE',
  '1998-03-12',
  d.id,
  'HR Executive',
  'FULL_TIME',
  'ACTIVE',
  '2024-01-15',
  18000000,
  'Ho Chi Minh City'
FROM departments d
WHERE d.name = 'Human Resources'
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO positions (code, name, description, department_id)
SELECT 'HR-EXEC', 'HR Executive', 'Human resources operations specialist', d.id
FROM departments d
WHERE d.name = 'Human Resources'
ON CONFLICT (code) DO NOTHING;

INSERT INTO positions (code, name, description, department_id)
SELECT 'BE-DEV', 'Backend Developer', 'Backend application developer', d.id
FROM departments d
WHERE d.name = 'Engineering'
ON CONFLICT (code) DO NOTHING;

INSERT INTO employment_contracts (
  contract_number,
  employee_id,
  contract_type,
  start_date,
  end_date,
  signed_date,
  salary,
  status,
  notes
)
SELECT
  'HDLD-EMP001-2024',
  e.id,
  'FIXED_TERM',
  '2024-01-15',
  '2026-01-14',
  '2024-01-10',
  18000000,
  'EXPIRED',
  'Seed contract for frontend development'
FROM employees e
WHERE e.employee_code = 'EMP001'
ON CONFLICT (contract_number) DO NOTHING;

INSERT INTO employees (
  employee_code,
  full_name,
  email,
  phone,
  gender,
  date_of_birth,
  department_id,
  position,
  employment_type,
  status,
  hire_date,
  base_salary,
  address
)
SELECT
  'EMP002',
  'Tran Quoc Bao',
  'quocbao@webhr.local',
  '0901000002',
  'MALE',
  '1996-10-08',
  d.id,
  'Backend Developer',
  'FULL_TIME',
  'ACTIVE',
  '2023-09-01',
  26000000,
  'Da Nang'
FROM departments d
WHERE d.name = 'Engineering'
ON CONFLICT (employee_code) DO NOTHING;
