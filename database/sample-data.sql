-- Dữ liệu mẫu thêm cho demo (chạy SAU schema.sql và seed.sql).
-- Chạy lại nhiều lần không bị trùng: dòng nào đã có (theo mã/tên/email) thì bỏ qua.
-- Ngày tháng tính theo ngày chạy, nên luôn có hợp đồng sắp hết hạn, lịch phỏng vấn sắp tới...
-- Lưu ý: không đụng vào EMP001, EMP002 và các tin tuyển dụng mẫu vì smoke test / Postman dùng chúng.

-- 1. Phòng ban -----------------------------------------------------------------
INSERT INTO departments (name, description)
VALUES
  ('Sales', 'Sales and customer care'),
  ('Warehouse', 'Warehouse and logistics'),
  ('Marketing', 'Brand and digital marketing')
ON CONFLICT (name) DO NOTHING;

-- 2. Chức vụ ------------------------------------------------------------------
INSERT INTO positions (code, name, description, department_id)
SELECT v.code, v.name, v.description, d.id
FROM (
  VALUES
    ('HR-MGR', 'HR Manager', 'Head of human resources', 'Human Resources'),
    ('HR-RECRUIT', 'Recruitment Specialist', 'Recruitment and onboarding', 'Human Resources'),
    ('ACC-CHIEF', 'Chief Accountant', 'Head of accounting', 'Finance'),
    ('ACC-STAFF', 'Accountant', 'Bookkeeping and tax reports', 'Finance'),
    ('ENG-LEAD', 'Engineering Lead', 'Leads the engineering team', 'Engineering'),
    ('FE-DEV', 'Frontend Developer', 'Web frontend developer', 'Engineering'),
    ('SALES-EXEC', 'Sales Executive', 'Store sales and customer care', 'Sales'),
    ('SHIFT-LEAD', 'Shift Leader', 'Leads a store shift', 'Sales'),
    ('WH-STAFF', 'Warehouse Staff', 'Receiving, picking and stock counts', 'Warehouse'),
    ('MKT-EXEC', 'Marketing Executive', 'Content and campaign execution', 'Marketing')
) AS v (code, name, description, department_name)
JOIN departments d ON d.name = v.department_name
ON CONFLICT (code) DO NOTHING;

-- 3. Nhân viên (EMP003 → EMP016) ------------------------------------------------
INSERT INTO employees (
  employee_code, full_name, email, phone, gender, date_of_birth, id_number,
  department_id, position_id, position, employment_type, status, hire_date, base_salary, address
)
SELECT
  v.code, v.full_name, v.email, v.phone, v.gender, v.date_of_birth, v.id_number,
  d.id, p.id, p.name, v.employment_type, v.status, v.hire_date, v.base_salary, v.address
FROM (
  VALUES
    ('EMP003', 'Trần Thị Bình', 'binh.tt@webhr.local', '0901000003', 'FEMALE', DATE '1988-07-21', '079188000003',
     'Human Resources', 'HR-MGR', 'FULL_TIME', 'ACTIVE', DATE '2020-02-01', 32000000, 'Quận 3, TP. Hồ Chí Minh'),
    ('EMP004', 'Lê Minh Châu', 'chau.lm@webhr.local', '0901000004', 'FEMALE', DATE '1995-11-02', '079195000004',
     'Human Resources', 'HR-RECRUIT', 'FULL_TIME', 'ACTIVE', DATE '2022-06-15', 17000000, 'Quận 7, TP. Hồ Chí Minh'),
    ('EMP005', 'Phạm Quốc Dũng', 'dung.pq@webhr.local', '0901000005', 'MALE', DATE '1985-04-10', '079085000005',
     'Finance', 'ACC-CHIEF', 'FULL_TIME', 'ACTIVE', DATE '2019-08-01', 35000000, 'Quận 1, TP. Hồ Chí Minh'),
    ('EMP006', 'Hoàng Thu Hà', 'ha.ht@webhr.local', '0901000006', 'FEMALE', DATE '1997-09-18', '079197000006',
     'Finance', 'ACC-STAFF', 'FULL_TIME', 'ON_LEAVE', DATE '2023-03-01', 14000000, 'TP. Thủ Đức, TP. Hồ Chí Minh'),
    ('EMP007', 'Vũ Đức Khang', 'khang.vd@webhr.local', '0901000007', 'MALE', DATE '1990-12-05', '079090000007',
     'Engineering', 'ENG-LEAD', 'FULL_TIME', 'ACTIVE', DATE '2018-05-02', 45000000, 'Quận Bình Thạnh, TP. Hồ Chí Minh'),
    ('EMP008', 'Đặng Mai Lan', 'lan.dm@webhr.local', '0901000008', 'FEMALE', DATE '1999-01-25', '079199000008',
     'Engineering', 'FE-DEV', 'FULL_TIME', 'ACTIVE', DATE '2024-07-01', 22000000, 'Quận Gò Vấp, TP. Hồ Chí Minh'),
    ('EMP009', 'Bùi Thanh Long', 'long.bt@webhr.local', '0901000009', 'MALE', DATE '1998-06-30', '079098000009',
     'Engineering', 'FE-DEV', 'FULL_TIME', 'ACTIVE', DATE '2025-01-06', 24000000, 'Quận 10, TP. Hồ Chí Minh'),
    ('EMP010', 'Ngô Thị Ngọc', 'ngoc.nt@webhr.local', '0901000010', 'FEMALE', DATE '1993-03-14', '079193000010',
     'Sales', 'SALES-EXEC', 'FULL_TIME', 'ACTIVE', DATE '2021-10-01', 15000000, 'Quận Tân Bình, TP. Hồ Chí Minh'),
    ('EMP011', 'Đỗ Văn Phúc', 'phuc.dv@webhr.local', '0901000011', 'MALE', DATE '1992-08-08', '079092000011',
     'Sales', 'SHIFT-LEAD', 'SHIFT', 'ACTIVE', DATE '2022-01-10', 13000000, 'Quận 5, TP. Hồ Chí Minh'),
    ('EMP012', 'Trịnh Hoài Nam', 'nam.th@webhr.local', '0901000012', 'MALE', DATE '2000-10-20', '079000000012',
     'Warehouse', 'WH-STAFF', 'SHIFT', 'ACTIVE', DATE '2025-11-03', 9000000, 'Huyện Nhà Bè, TP. Hồ Chí Minh'),
    ('EMP013', 'Lý Thu Trang', 'lythutrang@gmail.com', '0912333444', 'FEMALE', DATE '2001-05-05', '079301000013',
     'Human Resources', 'HR-RECRUIT', 'FULL_TIME', 'ACTIVE', CURRENT_DATE - 20, 12000000, 'Quận 8, TP. Hồ Chí Minh'),
    ('EMP014', 'Mai Anh Tuấn', 'tuan.ma@webhr.local', '0901000014', 'MALE', DATE '1996-02-29', '079096000014',
     'Marketing', 'MKT-EXEC', 'FULL_TIME', 'ACTIVE', DATE '2023-09-11', 16000000, 'Quận Phú Nhuận, TP. Hồ Chí Minh'),
    ('EMP015', 'Phan Gia Huy', 'huy.pg@webhr.local', '0901000015', 'MALE', DATE '2003-12-12', '079203000015',
     'Marketing', 'MKT-EXEC', 'INTERN', 'ACTIVE', DATE '2026-07-01', 5000000, 'Quận 11, TP. Hồ Chí Minh'),
    ('EMP016', 'Cao Thị Yến', 'yen.ct@webhr.local', '0901000016', 'FEMALE', DATE '1994-07-07', '079194000016',
     'Sales', 'SALES-EXEC', 'FULL_TIME', 'RESIGNED', DATE '2021-04-01', 15000000, 'Quận 12, TP. Hồ Chí Minh')
) AS v (
  code, full_name, email, phone, gender, date_of_birth, id_number,
  department_name, position_code, employment_type, status, hire_date, base_salary, address
)
JOIN departments d ON d.name = v.department_name
JOIN positions p ON p.code = v.position_code
ON CONFLICT (employee_code) DO NOTHING;

-- Quản lý trực tiếp.
UPDATE employees e
SET manager_id = m.id
FROM (
  VALUES
    ('EMP004', 'EMP003'), ('EMP013', 'EMP003'),
    ('EMP006', 'EMP005'),
    ('EMP008', 'EMP007'), ('EMP009', 'EMP007'),
    ('EMP011', 'EMP010'), ('EMP016', 'EMP010'),
    ('EMP012', 'EMP011'),
    ('EMP015', 'EMP014')
) AS v (employee_code, manager_code)
JOIN employees m ON m.employee_code = v.manager_code
WHERE e.employee_code = v.employee_code AND e.manager_id IS NULL;

-- 4. Hợp đồng lao động (mỗi nhân viên tối đa một hợp đồng ACTIVE) ---------------
INSERT INTO employment_contracts (
  contract_number, employee_id, contract_type, start_date, end_date, signed_date, salary, status, notes
)
SELECT
  v.contract_number, e.id, v.contract_type, v.start_date, v.end_date, v.start_date - 3, e.base_salary, v.status, v.notes
FROM (
  VALUES
    ('HDLD-EMP003-2020', 'EMP003', 'FIXED_TERM', DATE '2020-02-01', DATE '2022-01-31', 'EXPIRED', NULL),
    ('HDLD-EMP003-2022', 'EMP003', 'INDEFINITE', DATE '2022-02-01', NULL::date, 'ACTIVE', NULL),
    ('HDLD-EMP004-2024', 'EMP004', 'FIXED_TERM', DATE '2024-06-15', CURRENT_DATE + 20, 'ACTIVE', 'Sắp hết hạn, cần gia hạn'),
    ('HDLD-EMP005-2021', 'EMP005', 'INDEFINITE', DATE '2021-08-01', NULL::date, 'ACTIVE', NULL),
    ('HDLD-EMP006-2025', 'EMP006', 'FIXED_TERM', DATE '2025-03-01', DATE '2027-02-28', 'ACTIVE', NULL),
    ('HDLD-EMP007-2020', 'EMP007', 'INDEFINITE', DATE '2020-05-02', NULL::date, 'ACTIVE', NULL),
    ('HDLD-EMP008-2024', 'EMP008', 'FIXED_TERM', DATE '2024-07-01', CURRENT_DATE - 5, 'ACTIVE', 'Đã quá hạn, chưa ký lại'),
    ('HDLD-EMP009-2025-TV', 'EMP009', 'PROBATION', DATE '2025-01-06', DATE '2025-03-05', 'EXPIRED', NULL),
    ('HDLD-EMP009-2025', 'EMP009', 'FIXED_TERM', DATE '2025-03-06', DATE '2027-03-05', 'ACTIVE', NULL),
    ('HDLD-EMP010-2023', 'EMP010', 'INDEFINITE', DATE '2023-10-01', NULL::date, 'ACTIVE', NULL),
    ('HDLD-EMP011-2025', 'EMP011', 'FIXED_TERM', DATE '2025-01-10', CURRENT_DATE + 12, 'ACTIVE', NULL),
    ('HDLD-EMP012-2025', 'EMP012', 'SEASONAL', DATE '2025-11-03', DATE '2026-12-31', 'ACTIVE', NULL),
    ('HDLD-EMP013-2026', 'EMP013', 'PROBATION', CURRENT_DATE - 20, CURRENT_DATE + 40, 'ACTIVE', 'Tạo khi tuyển từ hồ sơ ứng viên'),
    ('HDLD-EMP014-2025', 'EMP014', 'FIXED_TERM', DATE '2025-09-11', DATE '2027-09-10', 'ACTIVE', NULL),
    ('HDLD-EMP015-2026', 'EMP015', 'SEASONAL', DATE '2026-07-01', DATE '2026-12-31', 'ACTIVE', NULL),
    ('HDLD-EMP016-2021', 'EMP016', 'FIXED_TERM', DATE '2021-04-01', DATE '2023-03-31', 'TERMINATED', 'Nghỉ việc')
) AS v (contract_number, employee_code, contract_type, start_date, end_date, status, notes)
JOIN employees e ON e.employee_code = v.employee_code
ON CONFLICT (contract_number) DO NOTHING;

-- 5. Hồ sơ ứng viên --------------------------------------------------------------
-- File CV dùng chung: backend/storage/cvs/sample-cv.pdf (phải có trên máy chạy backend).
INSERT INTO applications (
  job_posting_id, full_name, email, phone, cv_path, cv_original_name, cover_letter,
  status, note, interview_at, viewed_at, created_at, updated_at
)
SELECT
  j.id, v.full_name, v.email, v.phone, 'sample-cv.pdf', v.cv_name, v.cover_letter,
  v.status, v.note,
  CASE
    WHEN v.interview_in_days IS NULL THEN NULL
    ELSE ((CURRENT_DATE + v.interview_in_days) + v.interview_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'
  END,
  CASE WHEN v.viewed THEN NOW() - GREATEST(v.days_ago - 1, 0) * INTERVAL '1 day' END,
  NOW() - v.days_ago * INTERVAL '1 day',
  NOW() - GREATEST(v.days_ago - 1, 0) * INTERVAL '1 day'
FROM (
  VALUES
    ('JOB-ACC-01', 'Nguyễn Văn An', 'an.nv@gmail.com', '0912345678', 'CV_NguyenVanAn.pdf',
     'Em có 2 năm kinh nghiệm kế toán tổng hợp, thành thạo MISA và Excel.', 'REVIEWING',
     'Kinh nghiệm phù hợp, sẽ hẹn phỏng vấn', NULL::int, NULL::time, TRUE, 4),
    ('JOB-ACC-01', 'Phạm Thị Hồng', 'hong.pt@gmail.com', '0923456789', 'CV-Pham-Thi-Hong.pdf',
     NULL, 'NEW', NULL, NULL::int, NULL::time, FALSE, 1),
    ('JOB-FE-01', 'Lê Hoàng Sơn', 'son.lh@gmail.com', '0934567890', 'LeHoangSon_Frontend.pdf',
     'Em làm React được 2 năm, có sản phẩm cá nhân trên GitHub.', 'INTERVIEW',
     'Phỏng vấn kỹ thuật với anh Khang', 3, TIME '09:00', TRUE, 6),
    ('JOB-FE-01', 'Trần Minh Khoa', 'khoa.tm@gmail.com', '0945678901', 'TranMinhKhoa_CV.pdf',
     NULL, 'NEW', NULL, NULL::int, NULL::time, FALSE, 0),
    ('JOB-WH-01', 'Võ Thanh Tùng', 'tung.vt@gmail.com', '0938444555', 'CV_VoThanhTung.pdf',
     'Em từng làm kho 1 năm ở siêu thị, chịu được ca đêm.', 'HIRED',
     'Phỏng vấn đạt, chờ chuyển thành nhân sự', NULL::int, NULL::time, TRUE, 8),
    ('JOB-WH-01', 'Đinh Văn Tài', 'tai.dv@gmail.com', '0956789012', 'DinhVanTai.pdf',
     NULL, 'REJECTED', 'Chưa có kinh nghiệm kho, không làm được ca đêm', NULL::int, NULL::time, TRUE, 9),
    ('JOB-HR-01', 'Lý Thu Trang', 'lythutrang@gmail.com', '0912333444', 'LyThuTrang_CV.pdf',
     'Em đã làm thực tập tuyển dụng 6 tháng tại công ty dịch vụ nhân sự.', 'HIRED',
     'Đã nhận việc', NULL::int, NULL::time, TRUE, 25),
    ('JOB-HR-01', 'Đặng Mỹ Linh', 'linh.dm@gmail.com', '0967890123', 'DangMyLinh.pdf',
     NULL, 'REVIEWING', NULL, NULL::int, NULL::time, TRUE, 3),
    ('JOB-SALE-01', 'Hoàng Gia Bảo', 'bao.hg@gmail.com', '0978901234', 'HoangGiaBao_CV.pdf',
     'Em có 3 năm làm trưởng ca tại chuỗi cửa hàng tiện lợi.', 'INTERVIEW',
     NULL, 1, TIME '14:00', TRUE, 5),
    ('JOB-MKT-01', 'Bùi Thảo Vy', 'vy.bt@gmail.com', '0989012345', 'BuiThaoVy_Marketing.pdf',
     'Em là sinh viên năm 4 ngành Marketing, viết content tốt.', 'NEW', NULL, NULL::int, NULL::time, FALSE, 2),
    ('JOB-ADM-01', 'Nguyễn Thị Mai', 'mai.nt@gmail.com', '0990123456', 'NguyenThiMai.pdf',
     NULL, 'REJECTED', 'Tin đã đóng, ứng viên chưa phù hợp', NULL::int, NULL::time, TRUE, 15)
) AS v (
  job_code, full_name, email, phone, cv_name, cover_letter, status, note,
  interview_in_days, interview_time, viewed, days_ago
)
JOIN job_postings j ON j.code = v.job_code
WHERE NOT EXISTS (
  SELECT 1 FROM applications a WHERE a.job_posting_id = j.id AND LOWER(a.email) = LOWER(v.email)
);

-- Hồ sơ của Lý Thu Trang đã được chuyển thành nhân viên EMP013.
UPDATE applications a
SET employee_id = e.id
FROM employees e
WHERE e.employee_code = 'EMP013' AND a.email = 'lythutrang@gmail.com' AND a.employee_id IS NULL;

-- 6. Lịch sử thay đổi (thẻ "Lịch sử" ở trang chi tiết) ------------------------------
-- Nhân viên mẫu: tạo hồ sơ.
INSERT INTO audit_logs (entity_type, entity_id, action, details, actor_name, created_at)
SELECT
  'EMPLOYEE', e.id, 'CREATED',
  CASE WHEN a.id IS NULL THEN '{}'::jsonb
       ELSE jsonb_build_object('applicationCode', 'HS-' || LPAD(a.application_no::text, 6, '0')) END,
  'Trần Thị Bình', GREATEST(e.hire_date::timestamptz, e.created_at - INTERVAL '1 day')
FROM employees e
LEFT JOIN applications a ON a.employee_id = e.id
WHERE e.employee_code BETWEEN 'EMP003' AND 'EMP016'
  AND NOT EXISTS (SELECT 1 FROM audit_logs l WHERE l.entity_id = e.id AND l.action = 'CREATED');

-- Hồ sơ ứng viên mẫu: nộp hồ sơ, đổi trạng thái, hẹn phỏng vấn, chuyển thành nhân sự.
WITH sample AS (
  SELECT a.*
  FROM applications a
  WHERE a.cv_path = 'sample-cv.pdf'
)
INSERT INTO audit_logs (entity_type, entity_id, action, details, actor_name, created_at)
SELECT 'APPLICATION', s.id, 'SUBMITTED', '{}'::jsonb, s.full_name, s.created_at
FROM sample s
WHERE NOT EXISTS (SELECT 1 FROM audit_logs l WHERE l.entity_id = s.id AND l.action = 'SUBMITTED')
UNION ALL
SELECT 'APPLICATION', s.id, 'STATUS_CHANGED', jsonb_build_object('from', 'NEW', 'to', s.status),
       'Lê Minh Châu', COALESCE(s.viewed_at, s.created_at) + INTERVAL '2 hours'
FROM sample s
WHERE s.status <> 'NEW'
  AND NOT EXISTS (SELECT 1 FROM audit_logs l WHERE l.entity_id = s.id AND l.action = 'STATUS_CHANGED')
UNION ALL
SELECT 'APPLICATION', s.id, 'INTERVIEW_SCHEDULED', jsonb_build_object('interviewAt', s.interview_at),
       'Lê Minh Châu', COALESCE(s.viewed_at, s.created_at) + INTERVAL '3 hours'
FROM sample s
WHERE s.interview_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM audit_logs l WHERE l.entity_id = s.id AND l.action = 'INTERVIEW_SCHEDULED')
UNION ALL
SELECT 'APPLICATION', s.id, 'CONVERTED', jsonb_build_object('employeeCode', e.employee_code),
       'Trần Thị Bình', s.updated_at
FROM sample s
JOIN employees e ON e.id = s.employee_id
WHERE NOT EXISTS (SELECT 1 FROM audit_logs l WHERE l.entity_id = s.id AND l.action = 'CONVERTED');

-- 7. Ca làm việc, chấm công, nghỉ phép (HR-021 → HR-038) ----------------------------
-- Mốc thời gian tính từ thứ 2 của tuần hiện tại (gọi là M): lịch từ M-21 (3 tuần trước) tới tuần
-- này cho khối văn phòng, tới hết tuần sau cho khối ca (bán hàng, kho) — tuần sau của khối văn
-- phòng để trống để demo nút "Sao chép tuần trước". Có thêm lịch sử của EMP002 vì tài khoản mẫu
-- employee@webhr.local liên kết với nhân viên này (smoke test/Postman không dùng các bảng này).

-- 7.1 Thêm ca tối cho khối bán hàng/kho và một ca đã ngừng dùng.
INSERT INTO work_shifts (code, name, start_time, end_time, break_minutes, is_active)
VALUES
  ('SHIFT-TOI', 'Ca tối', '17:00', '22:00', 0, TRUE),
  ('SHIFT-GAY', 'Ca gãy (ngừng dùng)', '10:00', '14:00', 0, FALSE)
ON CONFLICT (code) DO NOTHING;

-- 7.2 Khối văn phòng: ca hành chính thứ 2 → thứ 6.
INSERT INTO work_schedules (employee_id, shift_id, work_date, status)
SELECT e.id, s.id, date_trunc('week', CURRENT_DATE)::date + d, 'SCHEDULED'
FROM employees e
JOIN work_shifts s ON s.code = 'SHIFT-HANHCHINH'
CROSS JOIN generate_series(-21, 4) AS d
WHERE e.employee_code IN ('EMP002', 'EMP003', 'EMP004', 'EMP005', 'EMP007', 'EMP008', 'EMP009', 'EMP013', 'EMP014', 'EMP015')
  AND EXTRACT(ISODOW FROM date_trunc('week', CURRENT_DATE)::date + d) <= 5
ON CONFLICT (employee_id, work_date) DO NOTHING;

-- 7.3 Khối ca: thứ 2 → thứ 7, mỗi tuần xoay vòng sáng / chiều / tối.
INSERT INTO work_schedules (employee_id, shift_id, work_date, status)
SELECT e.id, s.id, date_trunc('week', CURRENT_DATE)::date + d, 'SCHEDULED'
FROM (VALUES ('EMP010', 0), ('EMP011', 1), ('EMP012', 2)) AS v (code, rotation)
JOIN employees e ON e.employee_code = v.code
CROSS JOIN generate_series(-21, 12) AS d
JOIN work_shifts s
  ON s.code = (ARRAY['SHIFT-SANG', 'SHIFT-CHIEU', 'SHIFT-TOI'])[((d + 21) / 7 + v.rotation) % 3 + 1]
WHERE EXTRACT(ISODOW FROM date_trunc('week', CURRENT_DATE)::date + d) <= 6
ON CONFLICT (employee_id, work_date) DO NOTHING;

-- Một ca đã hủy trong tuần này (thực tập sinh đi học).
UPDATE work_schedules ws
SET status = 'CANCELLED', notes = 'Nghỉ đi học ở trường'
FROM employees e
WHERE ws.employee_id = e.id
  AND e.employee_code = 'EMP015'
  AND ws.work_date = date_trunc('week', CURRENT_DATE)::date + 2
  AND ws.status = 'SCHEDULED';

-- 7.4 Đơn nghỉ phép: đã duyệt, bị từ chối và đang chờ duyệt.
INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status, approved_by, approved_at, created_at)
SELECT
  e.id, v.leave_type, m.monday + v.start_day, m.monday + v.end_day, v.reason, v.status,
  CASE WHEN v.status <> 'PENDING' THEN (SELECT id FROM users WHERE email = 'manager@webhr.local') END,
  CASE WHEN v.status <> 'PENDING' THEN ((m.monday + v.created_day)::timestamp + INTERVAL '1 day 9 hours') AT TIME ZONE 'Asia/Ho_Chi_Minh' END,
  ((m.monday + v.created_day)::timestamp + INTERVAL '8 hours 30 minutes') AT TIME ZONE 'Asia/Ho_Chi_Minh'
FROM (
  VALUES
    ('EMP002', 'ANNUAL', -18, -18, -25, 'Việc gia đình', 'APPROVED'),
    ('EMP008', 'ANNUAL', -12, -11, -20, 'Về quê dự đám cưới em gái', 'APPROVED'),
    ('EMP014', 'SICK', -6, -6, -7, 'Sốt cao, có giấy khám bệnh', 'APPROVED'),
    ('EMP013', 'SICK', 2, 2, 1, 'Đau răng, đi nha sĩ', 'APPROVED'),
    ('EMP005', 'OTHER', 8, 8, 1, 'Đi học lớp nghiệp vụ thuế', 'REJECTED'),
    ('EMP009', 'ANNUAL', 9, 11, 3, 'Du lịch cùng gia đình', 'PENDING'),
    ('EMP010', 'UNPAID', 14, 15, 4, 'Giải quyết việc cá nhân', 'PENDING'),
    ('EMP002', 'ANNUAL', 15, 16, 4, 'Đưa bố mẹ đi khám sức khỏe', 'PENDING')
) AS v (code, leave_type, start_day, end_day, created_day, reason, status)
JOIN employees e ON e.employee_code = v.code
CROSS JOIN (SELECT date_trunc('week', CURRENT_DATE)::date AS monday) AS m
WHERE NOT EXISTS (
  SELECT 1 FROM leave_requests l WHERE l.employee_id = e.id AND l.start_date = m.monday + v.start_day
);

-- Ngày nghỉ đã duyệt ghi "Nghỉ phép" trong bảng chấm công (giống khi HR bấm duyệt).
INSERT INTO attendance_records (employee_id, work_date, status, note)
SELECT l.employee_id, d::date, 'ON_LEAVE', 'Nghỉ phép đã duyệt'
FROM leave_requests l
CROSS JOIN generate_series(l.start_date, l.end_date, INTERVAL '1 day') AS d
WHERE l.status = 'APPROVED'
ON CONFLICT (employee_id, work_date) DO NOTHING;

-- 7.5 Chấm công các ngày đã qua theo lịch. Mã băm (employee_code + ngày) cho kết quả cố định mỗi
-- lần chạy: ~5% vắng, ~12% đi trễ, ~1/4 số ngày có tăng ca, thỉnh thoảng quên chấm công ra.
INSERT INTO attendance_records (employee_id, schedule_id, work_date, check_in, check_out, status, note)
SELECT
  ws.employee_id, ws.id, ws.work_date,
  CASE WHEN r.k < 5 THEN NULL
       ELSE ((ws.work_date + s.start_time) + make_interval(mins => CASE WHEN r.k < 17 THEN 11 + r.k ELSE -(r.k % 12) END))
              AT TIME ZONE 'Asia/Ho_Chi_Minh' END,
  CASE WHEN r.k < 5 OR r.k = 99 THEN NULL
       ELSE ((ws.work_date + s.end_time) + make_interval(mins => CASE WHEN r.k % 4 = 0 THEN 30 + r.k % 60 ELSE r.k % 10 END))
              AT TIME ZONE 'Asia/Ho_Chi_Minh' END,
  CASE WHEN r.k < 5 THEN 'ABSENT' WHEN r.k < 17 THEN 'LATE' ELSE 'PRESENT' END,
  CASE WHEN r.k < 5 THEN 'Vắng không báo trước' WHEN r.k = 99 THEN 'Quên chấm công ra' END
FROM work_schedules ws
JOIN work_shifts s ON s.id = ws.shift_id
JOIN employees e ON e.id = ws.employee_id
CROSS JOIN LATERAL (SELECT abs(hashtext(e.employee_code || ws.work_date::text)) % 100 AS k) AS r
WHERE ws.status = 'SCHEDULED'
  AND ws.work_date < CURRENT_DATE
  AND ws.work_date >= date_trunc('week', CURRENT_DATE)::date - 21
ON CONFLICT (employee_id, work_date) DO NOTHING;

-- 7.6 Yêu cầu đổi ca: 2 đang chờ duyệt, 1 đã duyệt, 1 bị từ chối.
INSERT INTO shift_change_requests (employee_id, schedule_id, requested_shift_id, reason, status, reviewed_by, reviewed_at, created_at)
SELECT
  ws.employee_id, ws.id,
  -- Đã duyệt thì lịch đã được đổi sang ca mới, nên ca mong muốn trùng ca hiện tại.
  CASE WHEN v.status = 'APPROVED' THEN cs.id ELSE rs.id END,
  v.reason, v.status,
  CASE WHEN v.status <> 'PENDING' THEN (SELECT id FROM users WHERE email = 'manager@webhr.local') END,
  CASE WHEN v.status <> 'PENDING' THEN ((m.monday + v.created_day)::timestamp + INTERVAL '1 day 10 hours') AT TIME ZONE 'Asia/Ho_Chi_Minh' END,
  ((m.monday + v.created_day)::timestamp + INTERVAL '9 hours') AT TIME ZONE 'Asia/Ho_Chi_Minh'
FROM (
  VALUES
    ('EMP011', 8, 3, 'Buổi tối phải đón con, xin chuyển ca sáng', 'PENDING'),
    ('EMP012', 9, 4, 'Buổi sáng có lớp học thêm, xin chuyển ca chiều', 'PENDING'),
    ('EMP010', 1, -3, 'Có lịch khám răng buổi sáng', 'APPROVED'),
    ('EMP004', -4, -6, 'Chiều đi phỏng vấn ứng viên ở chi nhánh', 'REJECTED')
) AS v (code, work_day, created_day, reason, status)
CROSS JOIN (SELECT date_trunc('week', CURRENT_DATE)::date AS monday) AS m
JOIN employees e ON e.employee_code = v.code
JOIN work_schedules ws ON ws.employee_id = e.id AND ws.work_date = m.monday + v.work_day
JOIN work_shifts cs ON cs.id = ws.shift_id
JOIN work_shifts rs ON rs.code = CASE WHEN cs.code = 'SHIFT-SANG' THEN 'SHIFT-CHIEU' ELSE 'SHIFT-SANG' END
WHERE NOT EXISTS (SELECT 1 FROM shift_change_requests x WHERE x.schedule_id = ws.id);
