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

-- Tin tuyển dụng mẫu. Hạn nộp tính theo ngày chạy db:setup để tin luôn còn hạn khi dev.
INSERT INTO job_postings (
  code, title, department_id, employment_type, quantity, salary_min, salary_max,
  experience, location, working_time, description, requirements, benefits, deadline, status
)
SELECT
  job.code, job.title, d.id, job.employment_type, job.quantity, job.salary_min, job.salary_max,
  job.experience, job.location, job.working_time, job.description, job.requirements, job.benefits,
  CURRENT_DATE + job.days_open, job.status
FROM (
  VALUES
    (
      'JOB-ACC-01', 'Nhân viên Kế toán', 'Finance', 'FULL_TIME', 2, 10000000, 15000000,
      'Từ 1 năm', '123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh', 'Thứ 2 – Thứ 6, 8:00 – 17:00',
      E'Ghi nhận, hạch toán các nghiệp vụ kế toán phát sinh hằng ngày.\nLập chứng từ thu chi, đối chiếu công nợ với khách hàng và nhà cung cấp.\nHỗ trợ lập báo cáo thuế và báo cáo tài chính định kỳ.',
      E'Tốt nghiệp Cao đẳng/Đại học chuyên ngành Kế toán, Tài chính.\nCó ít nhất 1 năm kinh nghiệm ở vị trí tương đương.\nSử dụng thành thạo Excel và phần mềm kế toán.',
      E'Lương 10–15 triệu/tháng, thưởng theo hiệu quả công việc.\nĐóng BHXH, BHYT đầy đủ; 12 ngày phép năm.\nMôi trường trẻ, được đào tạo và có lộ trình thăng tiến.',
      15, 'OPEN'
    ),
    (
      'JOB-HR-01', 'Chuyên viên Tuyển dụng', 'Human Resources', 'FULL_TIME', 1, 12000000, 18000000,
      'Từ 2 năm', '123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh', 'Thứ 2 – Thứ 6, 8:00 – 17:00',
      E'Đăng tin và tìm nguồn ứng viên trên các kênh tuyển dụng.\nSàng lọc hồ sơ, sắp xếp và tham gia phỏng vấn.\nTheo dõi quá trình thử việc của nhân viên mới.',
      E'Tốt nghiệp Đại học chuyên ngành Quản trị nhân lực hoặc liên quan.\nKỹ năng giao tiếp và đánh giá ứng viên tốt.',
      E'Lương 12–18 triệu/tháng và thưởng theo số vị trí tuyển được.\nĐóng BHXH, BHYT đầy đủ; 12 ngày phép năm.',
      20, 'OPEN'
    ),
    (
      'JOB-FE-01', 'Lập trình viên Frontend', 'Engineering', 'FULL_TIME', 2, 15000000, 25000000,
      'Từ 1 năm', '123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh', 'Thứ 2 – Thứ 6, 8:30 – 17:30',
      E'Xây dựng giao diện web bằng ReactJS theo thiết kế Figma.\nKết nối giao diện với REST API và viết test cho các màn hình.',
      E'Nắm vững HTML, CSS, JavaScript và ReactJS.\nBiết dùng Git và làm việc theo Scrum.',
      E'Lương 15–25 triệu/tháng, review lương 2 lần/năm.\nĐược cấp laptop và hỗ trợ học chứng chỉ.',
      25, 'OPEN'
    ),
    (
      'JOB-WH-01', 'Nhân viên Kho', NULL, 'SHIFT', 3, 8000000, 10000000,
      'Không yêu cầu', 'Kho Bình Tân, TP. Hồ Chí Minh', 'Làm theo ca: sáng, chiều hoặc đêm',
      E'Nhập, xuất và kiểm đếm hàng hóa theo phiếu.\nSắp xếp kho gọn gàng, báo cáo tồn kho cuối ca.',
      E'Sức khỏe tốt, cẩn thận và trung thực.\nSẵn sàng làm theo ca.',
      E'Phụ cấp ca đêm và cơm ca.\nĐóng BHXH, BHYT đầy đủ.',
      18, 'OPEN'
    ),
    (
      'JOB-MKT-01', 'Thực tập sinh Marketing', NULL, 'INTERN', 2, NULL, NULL,
      'Sinh viên năm 3, năm 4', '123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh', 'Tối thiểu 4 buổi/tuần',
      E'Hỗ trợ viết nội dung cho website và mạng xã hội.\nTheo dõi số liệu các chiến dịch quảng cáo.',
      E'Sinh viên chuyên ngành Marketing, Truyền thông.\nCó khả năng viết tốt.',
      E'Trợ cấp thực tập và xác nhận thực tập cho nhà trường.\nCó cơ hội trở thành nhân viên chính thức.',
      30, 'OPEN'
    ),
    (
      'JOB-SALE-01', 'Trưởng ca Bán hàng', NULL, 'SHIFT', 1, 12000000, 15000000,
      'Từ 1 năm quản lý ca', 'Cửa hàng Quận 1, TP. Hồ Chí Minh', 'Làm theo ca, xoay ca hằng tuần',
      E'Phân công và giám sát nhân viên trong ca.\nKiểm tra doanh thu và bàn giao ca.',
      E'Có kinh nghiệm quản lý ca tại cửa hàng bán lẻ.\nKỹ năng giải quyết tình huống tốt.',
      E'Thưởng doanh số theo tháng.\nĐóng BHXH, BHYT đầy đủ.',
      22, 'OPEN'
    ),
    (
      'JOB-ADM-01', 'Nhân viên Hành chính', 'Human Resources', 'FULL_TIME', 1, 9000000, 12000000,
      'Từ 1 năm', '123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh', 'Thứ 2 – Thứ 6, 8:00 – 17:00',
      E'Quản lý văn phòng phẩm, lịch họp và công văn.',
      E'Tốt nghiệp Cao đẳng trở lên.',
      E'Đóng BHXH, BHYT đầy đủ.',
      -5, 'CLOSED'
    )
) AS job (
  code, title, department_name, employment_type, quantity, salary_min, salary_max,
  experience, location, working_time, description, requirements, benefits, days_open, status
)
LEFT JOIN departments d ON d.name = job.department_name
ON CONFLICT (code) DO UPDATE SET deadline = EXCLUDED.deadline, status = EXCLUDED.status;

-- Gắn chức vụ dạng chữ của các nhân viên cũ vào danh mục chức vụ cùng tên (chạy lại không sao).
UPDATE employees e
SET position_id = (
  SELECT p.id FROM positions p WHERE p.name = e.position ORDER BY p.created_at LIMIT 1
)
WHERE e.position_id IS NULL
  AND EXISTS (SELECT 1 FROM positions p WHERE p.name = e.position);

-- Liên kết tài khoản tự-phục vụ mẫu (employee@webhr.local, tạo trong setupDatabase.js) với EMP002.
UPDATE users
SET employee_id = (SELECT id FROM employees WHERE employee_code = 'EMP002')
WHERE email = 'employee@webhr.local' AND employee_id IS NULL;

-- Ca làm việc mẫu.
INSERT INTO work_shifts (code, name, start_time, end_time, break_minutes)
VALUES
  ('SHIFT-SANG', 'Ca sáng', '08:00', '12:00', 0),
  ('SHIFT-CHIEU', 'Ca chiều', '13:00', '17:00', 0),
  ('SHIFT-HANHCHINH', 'Ca hành chính', '08:00', '17:00', 60)
ON CONFLICT (code) DO NOTHING;

-- Lịch phân ca mẫu cho EMP002 trong tuần hiện tại (từ thứ 2 tuần này, 5 ngày làm việc).
INSERT INTO work_schedules (employee_id, shift_id, work_date, status)
SELECT
  e.id,
  s.id,
  (date_trunc('week', CURRENT_DATE) + (offset_days || ' days')::interval)::date,
  'SCHEDULED'
FROM employees e
JOIN work_shifts s ON s.code = 'SHIFT-HANHCHINH'
CROSS JOIN generate_series(0, 4) AS offset_days
WHERE e.employee_code = 'EMP002'
ON CONFLICT (employee_id, work_date) DO NOTHING;
