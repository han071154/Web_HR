import assert from 'node:assert/strict';
import { pool, query } from '../src/db.js';
import { removeCvFile } from '../src/middleware/cvUpload.js';

const apiUrl = process.env.API_URL || 'http://localhost:4000/api';

async function request(path, { token, method = 'GET', body, form, expected = 200 } = {}) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined)
  });
  const payload = response.status === 204 ? null : await response.json();

  assert.equal(
    response.status,
    expected,
    `${method} ${path} returned ${response.status}: ${JSON.stringify(payload)}`
  );

  return payload;
}

async function login(email, password) {
  const session = await request('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  return session.token;
}

function applicationForm(fields, file) {
  const form = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }

  if (file) {
    form.append('cv', new Blob([file.content], { type: file.type }), file.name);
  }

  return form;
}

// Trang tuyển dụng công khai: không gửi token. Hồ sơ thử được xóa thẳng trong DB ở cuối
// (chưa có API xóa hồ sơ), nên smoke test cần chạy cùng DATABASE_URL với backend.
async function recruitmentChecks(suffix) {
  const email = `smoke-${suffix}@example.com`;
  const pdf = { content: '%PDF-1.4\n% smoke test\n', type: 'application/pdf', name: 'cv-ứng-viên.pdf' };
  const validFields = {
    fullName: 'Ung Vien Smoke',
    email,
    phone: '0912 345 678',
    coverLetter: 'Temporary smoke test application',
    consent: 'true'
  };

  try {
    const jobs = await request('/public/jobs');
    const accountant = jobs.data.find((job) => job.code === 'JOB-ACC-01');
    assert.ok(accountant, 'Seed job JOB-ACC-01 is missing');
    assert.ok(jobs.data.every((job) => job.isOpen), 'Public list must only contain open jobs');
    assert.ok(!jobs.data.some((job) => job.code === 'JOB-ADM-01'), 'Closed job must not be listed');

    const searched = await request(`/public/jobs?search=${encodeURIComponent('kế toán')}`);
    assert.deepEqual(searched.data.map((job) => job.code), ['JOB-ACC-01']);

    const detail = await request(`/public/jobs/${accountant.id}`);
    assert.ok(detail.data.description);

    const closed = await query("SELECT id FROM job_postings WHERE code = 'JOB-ADM-01'");
    const closedDetail = await request(`/public/jobs/${closed.rows[0].id}`);
    assert.equal(closedDetail.data.isOpen, false);
    await request(`/public/jobs/${closed.rows[0].id}/applications`, {
      method: 'POST',
      expected: 409,
      form: applicationForm(validFields, pdf)
    });

    const applyPath = `/public/jobs/${accountant.id}/applications`;
    await request(applyPath, {
      method: 'POST',
      expected: 400,
      form: applicationForm(validFields, { content: 'not a pdf', type: 'application/pdf', name: 'fake.pdf' })
    });
    await request(applyPath, {
      method: 'POST',
      expected: 400,
      form: applicationForm(validFields, { content: 'plain text', type: 'text/plain', name: 'cv.txt' })
    });
    await request(applyPath, {
      method: 'POST',
      expected: 400,
      form: applicationForm({ ...validFields, phone: '0912' }, pdf)
    });
    await request(applyPath, { method: 'POST', expected: 400, form: applicationForm(validFields) });

    const applied = await request(applyPath, {
      method: 'POST',
      expected: 201,
      form: applicationForm(validFields, pdf)
    });
    assert.match(applied.data.applicationCode, /^HS-\d{6}$/);
    assert.equal(applied.data.status, 'NEW');

    const saved = await query('SELECT phone, cv_original_name FROM applications WHERE email = $1', [email]);
    assert.equal(saved.rows[0].phone, '0912345678');
    assert.equal(saved.rows[0].cv_original_name, 'cv-ứng-viên.pdf');

    await request(applyPath, {
      method: 'POST',
      expected: 409,
      form: applicationForm({ ...validFields, email: email.toUpperCase() }, pdf)
    });
  } finally {
    const removed = await query('DELETE FROM applications WHERE email = $1 RETURNING id, cv_path', [email]);

    for (const row of removed.rows) {
      await removeCvFile(row.cv_path);
      await query('DELETE FROM audit_logs WHERE entity_id = $1', [row.id]);
    }
  }
}

// Quy trình tuyển dụng phía HR: tạo tin → ứng viên nộp → xét → phỏng vấn → tuyển thành nhân viên.
async function hrRecruitmentChecks({ managerToken, staffToken }, suffix) {
  const email = `hire-${suffix}@example.com`;
  const pdf = { content: '%PDF-1.4\n% hire smoke test\n', type: 'application/pdf', name: 'cv-tuyen-dung.pdf' };
  let jobId;
  let employeeId;

  try {
    const job = await request('/jobs', {
      token: staffToken,
      method: 'POST',
      expected: 201,
      body: {
        code: `job-smoke-${suffix}`,
        title: `Nhân viên Kho Smoke ${suffix}`,
        employmentType: 'SHIFT',
        quantity: 2,
        salaryMin: 8000000,
        salaryMax: 10000000,
        description: 'Temporary smoke test job posting',
        status: 'DRAFT'
      }
    });
    jobId = job.data.id;
    assert.equal(job.data.code, `JOB-SMOKE-${suffix}`);
    assert.equal(job.data.isOpen, false);
    assert.equal(job.data.applicationCount, 0);

    await request('/jobs', {
      token: staffToken,
      method: 'POST',
      expected: 400,
      body: { ...job.data, code: `BAD-${suffix}`, salaryMin: 9000000, salaryMax: 1000000 }
    });

    // Tin nháp không hiện ở trang công khai; mở tin thì hiện.
    await request(`/public/jobs/${jobId}`, { expected: 404 });
    const opened = await request(`/jobs/${jobId}`, { token: staffToken, method: 'PUT', body: { status: 'OPEN' } });
    assert.equal(opened.data.isOpen, true);

    const applied = await request(`/public/jobs/${jobId}/applications`, {
      method: 'POST',
      expected: 201,
      form: applicationForm(
        { fullName: 'Ung Vien Trung Tuyen', email, phone: '0987654321', consent: 'true' },
        pdf
      )
    });

    const list = await request(`/applications?jobId=${jobId}`, { token: staffToken });
    assert.equal(list.data.length, 1);
    const applicationId = list.data[0].id;
    assert.equal(list.data[0].applicationCode, applied.data.applicationCode);
    const searched = await request(`/applications?search=${applied.data.applicationCode}`, { token: staffToken });
    assert.ok(searched.data.some((item) => item.id === applicationId));

    const cvResponse = await fetch(`${apiUrl}/applications/${applicationId}/cv`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert.equal(cvResponse.status, 200);
    assert.match(cvResponse.headers.get('content-type'), /pdf/);
    assert.ok((await cvResponse.text()).startsWith('%PDF'));
    await request(`/applications/${applicationId}/cv`, { expected: 401 });

    const reviewing = await request(`/applications/${applicationId}`, {
      token: staffToken,
      method: 'PATCH',
      body: { status: 'REVIEWING', note: 'CV phù hợp' }
    });
    assert.equal(reviewing.data.status, 'REVIEWING');
    const interview = await request(`/applications/${applicationId}`, {
      token: staffToken,
      method: 'PATCH',
      body: { status: 'INTERVIEW', interviewAt: '2026-10-10T09:00:00+07:00' }
    });
    assert.equal(interview.data.note, 'CV phù hợp');
    assert.equal(new Date(interview.data.interviewAt).toISOString(), '2026-10-10T02:00:00.000Z');
    // Phỏng vấn bắt buộc có lịch hẹn.
    await request(`/applications/${applicationId}`, {
      token: staffToken,
      method: 'PATCH',
      expected: 400,
      body: { status: 'INTERVIEW', interviewAt: null }
    });

    await request(`/jobs/${jobId}`, { token: staffToken, method: 'DELETE', expected: 403 });
    await request(`/jobs/${jobId}`, { token: managerToken, method: 'DELETE', expected: 409 });

    const convertBody = {
      employeeCode: `HIRE-${suffix}`,
      hireDate: '2026-10-15',
      baseSalary: 9000000,
      contractType: 'PROBATION',
      contractEndDate: '2026-12-14'
    };

    // Chưa "Đậu" thì chưa chuyển thành nhân sự được.
    await request(`/applications/${applicationId}/convert`, {
      token: staffToken,
      method: 'POST',
      expected: 409,
      body: convertBody
    });
    const passed = await request(`/applications/${applicationId}`, {
      token: staffToken,
      method: 'PATCH',
      body: { status: 'HIRED' }
    });
    assert.equal(passed.data.status, 'HIRED');
    assert.equal(passed.data.employeeId, null);
    await request(`/applications/${applicationId}/convert`, {
      token: staffToken,
      method: 'POST',
      expected: 400,
      body: { ...convertBody, contractEndDate: null }
    });

    const converted = await request(`/applications/${applicationId}/convert`, {
      token: staffToken,
      method: 'POST',
      expected: 201,
      body: convertBody
    });
    assert.equal(converted.data.status, 'HIRED');
    assert.equal(converted.data.employeeCode, `HIRE-${suffix}`);
    employeeId = converted.data.employeeId;

    const employee = await request(`/employees/${employeeId}`, { token: staffToken });
    assert.equal(employee.data.email, email);
    assert.equal(employee.data.phone, '0987654321');
    assert.equal(employee.data.position, `Nhân viên Kho Smoke ${suffix}`);
    assert.equal(employee.data.employmentType, 'SHIFT');
    assert.equal(employee.data.hireDate, '2026-10-15');
    assert.equal(employee.data.baseSalary, 9000000);

    const firstContract = await request(`/contracts?employeeId=${employeeId}`, { token: staffToken });
    assert.equal(firstContract.data.length, 1);
    assert.equal(firstContract.data[0].contractType, 'PROBATION');
    assert.equal(firstContract.data[0].status, 'ACTIVE');
    assert.equal(firstContract.data[0].endDate, '2026-12-14');

    await request(`/applications/${applicationId}/convert`, {
      token: staffToken,
      method: 'POST',
      expected: 409,
      body: { ...convertBody, employeeCode: `HIRE2-${suffix}` }
    });
    await request(`/applications/${applicationId}`, {
      token: staffToken,
      method: 'PATCH',
      expected: 409,
      body: { status: 'REJECTED' }
    });

    // Mở chi tiết thì hồ sơ được đánh dấu đã xem và có lịch sử xử lý.
    const detail = await request(`/applications/${applicationId}`, { token: staffToken });
    assert.ok(detail.data.viewedAt);
    const actions = detail.data.history.map((item) => item.action);
    for (const action of ['SUBMITTED', 'STATUS_CHANGED', 'INTERVIEW_SCHEDULED', 'NOTE_UPDATED', 'CONVERTED']) {
      assert.ok(actions.includes(action), `Application history is missing ${action}`);
    }

    const employeeHistory = await request(`/employees/${employeeId}/history`, { token: staffToken });
    assert.deepEqual(employeeHistory.data.map((item) => item.action).sort(), ['CONTRACT_ADDED', 'CREATED']);

    const jobAfter = await request(`/jobs/${jobId}`, { token: staffToken });
    assert.equal(jobAfter.data.applicationCount, 1);

    // Đăng tin với hạn nộp đã qua thì bị chặn.
    await request(`/jobs/${jobId}`, {
      token: staffToken,
      method: 'PUT',
      expected: 400,
      body: { status: 'OPEN', deadline: '2020-01-01' }
    });
  } finally {
    const removed = await query('DELETE FROM applications WHERE email = $1 RETURNING id, cv_path', [email]);

    for (const row of removed.rows) {
      await removeCvFile(row.cv_path);
      await query('DELETE FROM audit_logs WHERE entity_id = $1', [row.id]);
    }

    if (employeeId) {
      await query('DELETE FROM employees WHERE id = $1', [employeeId]);
      await query('DELETE FROM audit_logs WHERE entity_id = $1', [employeeId]);
    }

    if (jobId) {
      await query('DELETE FROM job_postings WHERE id = $1', [jobId]);
    }
  }
}

async function main() {
  const [adminToken, managerToken, staffToken] = await Promise.all([
    login('admin@webhr.local', 'admin123'),
    login('manager@webhr.local', 'manager123'),
    login('staff@webhr.local', 'staff123')
  ]);
  const suffix = Date.now().toString().slice(-8);
  const startedAt = new Date();
  let departmentId;
  let positionId;
  let linkedEmployeeId;
  let contractId;

  try {
    const employees = await request('/employees', { token: adminToken });
    const employee = employees.data.find((item) => item.employeeCode === 'EMP001');

    assert.ok(employee, 'Seed employee EMP001 is missing');
    assert.equal(employee.dateOfBirth, '1998-03-12');

    await request('/employees', {
      token: adminToken,
      method: 'POST',
      expected: 409,
      body: {
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        email: `duplicate-${suffix}@webhr.local`,
        gender: 'FEMALE',
        position: employee.position,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        hireDate: '2026-01-01',
        baseSalary: 10000000
      }
    });

    await request('/employees', {
      token: adminToken,
      method: 'POST',
      expected: 409,
      body: {
        employeeCode: `TEST-${suffix}`,
        fullName: employee.fullName,
        email: employee.email,
        gender: 'FEMALE',
        position: employee.position,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        hireDate: '2026-01-01',
        baseSalary: 10000000
      }
    });

    const clearedEmployee = await request(`/employees/${employee.id}`, {
      token: staffToken,
      method: 'PUT',
      body: { departmentId: null }
    });
    assert.equal(clearedEmployee.data.departmentId, null);

    await request(`/employees/${employee.id}`, {
      token: staffToken,
      method: 'PUT',
      body: { departmentId: employee.departmentId }
    });

    const department = await request('/departments', {
      token: managerToken,
      method: 'POST',
      expected: 201,
      body: { name: `Quality Assurance ${suffix}`, description: 'Temporary smoke test department' }
    });
    departmentId = department.data.id;

    await request('/departments', {
      token: staffToken,
      method: 'POST',
      expected: 403,
      body: { name: `Forbidden ${suffix}` }
    });

    const updatedDepartment = await request(`/departments/${departmentId}`, {
      token: managerToken,
      method: 'PUT',
      body: { description: null }
    });
    assert.equal(updatedDepartment.data.description, null);
    await request(`/departments/${departmentId}`, { token: staffToken });

    // Phòng còn nhân viên thì không xóa được; chuyển nhân viên đi rồi mới xóa.
    await request(`/employees/${employee.id}`, {
      token: staffToken,
      method: 'PUT',
      body: { departmentId }
    });
    await request(`/departments/${departmentId}`, {
      token: managerToken,
      method: 'DELETE',
      expected: 409
    });
    await request(`/employees/${employee.id}`, {
      token: staffToken,
      method: 'PUT',
      body: { departmentId: employee.departmentId }
    });

    const position = await request('/positions', {
      token: managerToken,
      method: 'POST',
      expected: 201,
      body: {
        code: `QA-${suffix}`,
        name: `QA Engineer ${suffix}`,
        departmentId,
        description: 'Temporary smoke test position',
        isActive: true
      }
    });
    positionId = position.data.id;

    // Nhân viên gắn với chức vụ trong danh mục: đổi tên chức vụ thì hồ sơ đổi theo.
    const linkedEmployee = await request('/employees', {
      token: staffToken,
      method: 'POST',
      expected: 201,
      body: {
        employeeCode: `POS-${suffix}`,
        fullName: 'Smoke Position Link',
        email: `position-${suffix}@webhr.local`,
        positionId,
        position: 'Ignored free text',
        employmentType: 'SHIFT',
        status: 'ACTIVE',
        hireDate: '2026-01-01',
        baseSalary: 10000000
      }
    });
    linkedEmployeeId = linkedEmployee.data.id;
    assert.equal(linkedEmployee.data.positionId, positionId);
    assert.equal(linkedEmployee.data.position, `QA Engineer ${suffix}`);

    await request(`/positions/${positionId}`, {
      token: managerToken,
      method: 'PUT',
      body: { name: `QA Lead ${suffix}` }
    });
    const renamedEmployee = await request(`/employees/${linkedEmployeeId}`, { token: staffToken });
    assert.equal(renamedEmployee.data.position, `QA Lead ${suffix}`);

    // CCCD 12 số, quản lý trực tiếp, và lịch sử thay đổi của hồ sơ.
    const idNumber = `0790${suffix}`;
    const managed = await request(`/employees/${linkedEmployeeId}`, {
      token: staffToken,
      method: 'PUT',
      body: { idNumber, managerId: employee.id }
    });
    assert.equal(managed.data.idNumber, idNumber);
    assert.equal(managed.data.managerName, employee.fullName);
    await request(`/employees/${linkedEmployeeId}`, {
      token: staffToken,
      method: 'PUT',
      expected: 400,
      body: { idNumber: '12345' }
    });
    await request(`/employees/${linkedEmployeeId}`, {
      token: staffToken,
      method: 'PUT',
      expected: 400,
      body: { managerId: linkedEmployeeId }
    });
    const history = await request(`/employees/${linkedEmployeeId}/history`, { token: staffToken });
    assert.equal(history.data[0].action, 'UPDATED');
    assert.deepEqual(Object.keys(history.data[0].details.fields).sort(), ['idNumber', 'managerName']);
    assert.equal(history.data.at(-1).action, 'CREATED');

    await request('/employees', {
      token: staffToken,
      method: 'POST',
      expected: 400,
      body: {
        employeeCode: `NOPOS-${suffix}`,
        fullName: 'Smoke Missing Position',
        email: `nopos-${suffix}@webhr.local`,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        hireDate: '2026-01-01',
        baseSalary: 0
      }
    });

    const updatedPosition = await request(`/positions/${positionId}`, {
      token: managerToken,
      method: 'PUT',
      body: { departmentId: null, isActive: false }
    });
    assert.equal(updatedPosition.data.departmentId, null);
    assert.equal(updatedPosition.data.isActive, false);
    await request('/positions?active=false', { token: staffToken });

    const contract = await request('/contracts', {
      token: staffToken,
      method: 'POST',
      expected: 201,
      body: {
        contractNumber: `HDLD-TEST-${suffix}`,
        employeeId: employee.id,
        contractType: 'FIXED_TERM',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        signedDate: '2025-12-20',
        salary: 20000000,
        status: 'ACTIVE',
        notes: 'Temporary smoke test contract'
      }
    });
    contractId = contract.data.id;
    assert.equal(contract.data.startDate, '2026-01-01');

    // Hợp đồng xác định thời hạn bắt buộc có ngày kết thúc; không thời hạn thì không được có.
    await request(`/contracts/${contractId}`, {
      token: staffToken,
      method: 'PUT',
      expected: 400,
      body: { endDate: null }
    });
    await request(`/contracts/${contractId}`, {
      token: staffToken,
      method: 'PUT',
      expected: 400,
      body: { contractType: 'INDEFINITE' }
    });

    const updatedContract = await request(`/contracts/${contractId}`, {
      token: staffToken,
      method: 'PUT',
      body: { contractType: 'INDEFINITE', endDate: null, notes: null }
    });
    assert.equal(updatedContract.data.endDate, null);
    assert.equal(updatedContract.data.notes, null);
    await request(`/contracts/${contractId}`, { token: managerToken });

    // Mỗi nhân viên chỉ có một hợp đồng đang hiệu lực.
    await request('/contracts', {
      token: staffToken,
      method: 'POST',
      expected: 409,
      body: {
        contractNumber: `HDLD-TEST2-${suffix}`,
        employeeId: employee.id,
        contractType: 'PROBATION',
        startDate: '2026-01-01',
        endDate: '2026-02-28',
        salary: 15000000,
        status: 'ACTIVE'
      }
    });

    const avatarForm = new FormData();
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    avatarForm.append('avatar', new Blob([png], { type: 'image/png' }), 'avatar.png');
    const uploaded = await request(`/employees/${employee.id}/avatar`, {
      token: staffToken,
      method: 'POST',
      form: avatarForm
    });
    assert.ok(uploaded.data.avatarUrl);
    const avatarResponse = await fetch(uploaded.data.avatarUrl);
    assert.equal(avatarResponse.status, 200);
    await request(`/employees/${employee.id}/avatar`, {
      token: staffToken,
      method: 'DELETE',
      expected: 204
    });

    await recruitmentChecks(suffix);
    await hrRecruitmentChecks({ managerToken, staffToken }, suffix);

    console.log('API smoke test passed.');
  } finally {
    if (contractId) {
      await request(`/contracts/${contractId}`, {
        token: managerToken,
        method: 'DELETE',
        expected: 204
      }).catch(() => undefined);
    }

    if (linkedEmployeeId) {
      await request(`/employees/${linkedEmployeeId}`, {
        token: managerToken,
        method: 'DELETE',
        expected: 204
      }).catch(() => undefined);
    }

    if (positionId) {
      await request(`/positions/${positionId}`, {
        token: managerToken,
        method: 'DELETE',
        expected: 204
      }).catch(() => undefined);
    }

    if (departmentId) {
      await request(`/departments/${departmentId}`, {
        token: managerToken,
        method: 'DELETE',
        expected: 204
      }).catch(() => undefined);
    }

    // Smoke test sửa tạm nhân viên mẫu rồi trả lại; xóa nhật ký sinh ra để lịch sử thật không bị lẫn.
    await query("DELETE FROM audit_logs WHERE entity_type = 'EMPLOYEE' AND created_at >= $1", [startedAt]);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
