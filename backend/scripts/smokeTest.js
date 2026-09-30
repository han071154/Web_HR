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
    const removed = await query('DELETE FROM applications WHERE email = $1 RETURNING cv_path', [email]);

    for (const row of removed.rows) {
      await removeCvFile(row.cv_path);
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
  let departmentId;
  let positionId;
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

    const updatedContract = await request(`/contracts/${contractId}`, {
      token: staffToken,
      method: 'PUT',
      body: { endDate: null, notes: null }
    });
    assert.equal(updatedContract.data.endDate, null);
    assert.equal(updatedContract.data.notes, null);
    await request(`/contracts/${contractId}`, { token: managerToken });

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

    console.log('API smoke test passed.');
  } finally {
    if (contractId) {
      await request(`/contracts/${contractId}`, {
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
