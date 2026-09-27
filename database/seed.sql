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
