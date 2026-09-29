import assert from 'node:assert/strict';

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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
