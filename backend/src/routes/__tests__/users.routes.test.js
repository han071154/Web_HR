import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config.js';

// HR-007: Admin quản lý tài khoản. Mock tầng DB; mỗi câu SQL được trả lời theo nội dung câu lệnh.
vi.mock('../../db.js', () => ({ query: vi.fn(), pool: {} }));

const { query } = await import('../../db.js');
const { requireAuth } = await import('../../middleware/auth.js');
const { default: usersRouter } = await import('../users.routes.js');
const { clearRevokedSessions } = await import('../../utils/sessionRevocation.js');

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', requireAuth, usersRouter);
  app.get('/api/ping', requireAuth, (req, res) => res.json({ ok: true, role: req.user.role }));
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.name === 'ZodError' ? 400 : 500);
    res.status(status).json({ message: error.name === 'ZodError' ? 'Validation error' : error.message });
  });
  return app;
}

// iat lùi 10 giây: token "cũ" được cấp trước mọi thao tác khóa / đặt lại trong test.
function tokenFor(role, sub, iatOffset = -10) {
  const iat = Math.floor(Date.now() / 1000) + iatOffset;
  return jwt.sign({ sub, email: `${role.toLowerCase()}@webhr.local`, fullName: role, role, iat }, config.jwtSecret);
}

const adminToken = () => tokenFor('ADMIN', ADMIN_ID);

function userRow(overrides = {}) {
  return {
    id: USER_ID,
    email: 'nv017@webhr.local',
    full_name: 'Nguyễn Văn A',
    role: 'EMPLOYEE',
    is_active: true,
    employee_id: EMPLOYEE_ID,
    employee_code: 'EMP017',
    employee_name: 'Nguyễn Văn A',
    department_name: 'Engineering',
    password_changed_at: null,
    created_at: '2026-10-20T00:00:00.000Z',
    updated_at: '2026-10-20T00:00:00.000Z',
    ...overrides
  };
}

// handlers: [[RegExp, result | (params) => result], ...] – câu SQL đầu tiên khớp được trả kết quả.
function answer(handlers) {
  query.mockImplementation(async (sql, params) => {
    for (const [pattern, result] of handlers) {
      if (pattern.test(sql)) {
        return typeof result === 'function' ? result(params) : result;
      }
    }

    return { rows: [] };
  });
}

const app = createApp();

beforeEach(() => {
  query.mockReset();
  clearRevokedSessions();
});

describe('Quyền truy cập /api/users', () => {
  it.each(['HR_MANAGER', 'HR_STAFF', 'EMPLOYEE'])('%s nhận 403', async (role) => {
    const response = await request(app).get('/api/users').set('Authorization', `Bearer ${tokenFor(role, USER_ID)}`);

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('không có token nhận 401', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
  });
});

describe('GET /api/users', () => {
  it('trả danh sách kèm hồ sơ liên kết và phân trang, lọc theo vai trò / trạng thái', async () => {
    answer([
      [/COUNT\(\*\)/, { rows: [{ count: 1 }] }],
      [/FROM users u/, { rows: [userRow()] }]
    ]);

    const response = await request(app)
      .get('/api/users?search=nguyen&role=EMPLOYEE&status=active&linked=yes')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      id: USER_ID,
      email: 'nv017@webhr.local',
      role: 'EMPLOYEE',
      isActive: true,
      employeeCode: 'EMP017',
      departmentName: 'Engineering'
    });
    expect(response.body.data[0]).not.toHaveProperty('passwordHash');
    expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    const [countSql, countValues] = query.mock.calls[0];
    expect(countSql).toMatch(/unaccent/);
    expect(countSql).toMatch(/u\.is_active = TRUE/);
    expect(countSql).toMatch(/u\.employee_id IS NOT NULL/);
    expect(countValues).toEqual(['%nguyen%', 'EMPLOYEE']);
  });
});

describe('POST /api/users', () => {
  it('cấp tài khoản Nhân viên liên kết hồ sơ, lấy họ tên từ hồ sơ, mã hóa mật khẩu', async () => {
    let insertParams;
    answer([
      [/FROM employees e\s+LEFT JOIN users u ON u.employee_id = e.id\s+WHERE e.id/, { rows: [{ id: EMPLOYEE_ID, full_name: 'Nguyễn Văn A', linked_user_id: null }] }],
      [/SELECT id FROM users WHERE email/, { rows: [] }],
      [/INSERT INTO users/, (params) => { insertParams = params; return { rows: [{ id: USER_ID }] }; }],
      [/INSERT INTO audit_logs/, { rows: [] }],
      [/FROM users u/, { rows: [userRow()] }]
    ]);

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ email: '  NV017@WebHR.local ', role: 'EMPLOYEE', password: 'Matkhau123', employeeId: EMPLOYEE_ID });

    expect(response.status).toBe(201);
    expect(response.body.data.employeeCode).toBe('EMP017');
    expect(insertParams[0]).toBe('nv017@webhr.local');
    expect(insertParams[1]).not.toBe('Matkhau123');
    expect(insertParams[1]).toMatch(/^\$2[aby]\$/);
    expect(insertParams.slice(2)).toEqual(['Nguyễn Văn A', 'EMPLOYEE', EMPLOYEE_ID]);
  });

  it('cấp tài khoản HR không cần hồ sơ', async () => {
    answer([
      [/SELECT id FROM users WHERE email/, { rows: [] }],
      [/INSERT INTO users/, { rows: [{ id: USER_ID }] }],
      [/FROM users u/, { rows: [userRow({ role: 'HR_STAFF', employee_id: null, employee_code: null })] }]
    ]);

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ email: 'hr2@webhr.local', fullName: 'HR Staff 2', role: 'HR_STAFF', password: 'Matkhau123' });

    expect(response.status).toBe(201);
    expect(response.body.data.role).toBe('HR_STAFF');
  });

  it('tài khoản Nhân viên chưa chọn hồ sơ → 400', async () => {
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ email: 'x@webhr.local', fullName: 'Nhân viên X', role: 'EMPLOYEE', password: 'Matkhau123' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Employee accounts must be linked to an employee profile');
  });

  it('hồ sơ đã có tài khoản khác → 409', async () => {
    answer([[/FROM employees e/, { rows: [{ id: EMPLOYEE_ID, full_name: 'A', linked_user_id: ADMIN_ID }] }]]);

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ email: 'x@webhr.local', role: 'EMPLOYEE', password: 'Matkhau123', employeeId: EMPLOYEE_ID });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('This employee already has a linked account');
  });

  it('email đã có tài khoản → 409', async () => {
    answer([[/SELECT id FROM users WHERE email/, { rows: [{ id: ADMIN_ID }] }]]);

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ email: 'admin@webhr.local', fullName: 'Trùng', role: 'HR_STAFF', password: 'Matkhau123' });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Account email already exists');
  });

  it.each([
    ['quá ngắn', 'abc123'],
    ['không có số', 'matkhaukhongso'],
    ['không có chữ', '12345678']
  ])('mật khẩu %s → 400', async (_label, password) => {
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ email: 'y@webhr.local', fullName: 'Y', role: 'HR_STAFF', password });

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('vai trò không tồn tại → 400', async () => {
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ email: 'y@webhr.local', fullName: 'Y', role: 'SUPER_ADMIN', password: 'Matkhau123' });

    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/users/:id', () => {
  it('khóa tài khoản: token cũ của người đó bị chặn ngay', async () => {
    const employeeToken = tokenFor('EMPLOYEE', USER_ID);
    expect((await request(app).get('/api/ping').set('Authorization', `Bearer ${employeeToken}`)).status).toBe(200);

    let updateParams;
    let state = userRow();
    answer([
      [/UPDATE users/, (params) => { updateParams = params; state = userRow({ is_active: params[3] }); return { rows: [] }; }],
      [/INSERT INTO audit_logs/, (params) => ({ rows: [], params })],
      [/FROM users u/, () => ({ rows: [state] })]
    ]);

    const response = await request(app)
      .patch(`/api/users/${USER_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data.isActive).toBe(false);
    expect(updateParams[3]).toBe(false);
    const audit = query.mock.calls.find(([sql]) => /INSERT INTO audit_logs/.test(sql));
    expect(audit[1][2]).toBe('USER_LOCKED');
    expect((await request(app).get('/api/ping').set('Authorization', `Bearer ${employeeToken}`)).status).toBe(401);
  });

  it('đổi vai trò: buộc đăng nhập lại (token cũ bị chặn, token mới dùng được)', async () => {
    let updateSql;
    answer([
      [/UPDATE users/, () => ({ rows: [] })],
      [/FROM users u/, { rows: [userRow({ role: 'HR_STAFF', employee_id: null })] }]
    ]);
    const answerSql = query.getMockImplementation();
    query.mockImplementation(async (sql, params) => {
      if (/UPDATE users/.test(sql)) {
        updateSql = sql;
      }

      return answerSql(sql, params);
    });

    const oldToken = tokenFor('HR_STAFF', USER_ID);
    const response = await request(app)
      .patch(`/api/users/${USER_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ role: 'HR_MANAGER' });

    expect(response.status).toBe(200);
    expect(updateSql).toMatch(/password_changed_at/);
    expect((await request(app).get('/api/ping').set('Authorization', `Bearer ${oldToken}`)).status).toBe(401);
    const freshToken = tokenFor('HR_MANAGER', USER_ID, 1);
    expect((await request(app).get('/api/ping').set('Authorization', `Bearer ${freshToken}`)).status).toBe(200);
  });

  it('Admin không tự khóa / tự hạ quyền mình → 409', async () => {
    answer([[/FROM users u/, { rows: [userRow({ id: ADMIN_ID, role: 'ADMIN', employee_id: null })] }]]);

    for (const body of [{ isActive: false }, { role: 'HR_MANAGER' }]) {
      const response = await request(app)
        .patch(`/api/users/${ADMIN_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send(body);

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('You cannot lock or change the role of your own account');
    }
  });

  it('không hạ quyền / khóa Admin cuối cùng → 409', async () => {
    const otherAdmin = '44444444-4444-4444-8444-444444444444';
    answer([
      [/role = 'ADMIN' AND is_active = TRUE/, { rows: [{ count: 0 }] }],
      [/FROM users u/, { rows: [userRow({ id: otherAdmin, role: 'ADMIN', employee_id: null })] }]
    ]);

    const response = await request(app)
      .patch(`/api/users/${otherAdmin}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ isActive: false });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('At least one active admin account is required');
  });

  it('gỡ liên kết hồ sơ của tài khoản Nhân viên → 400', async () => {
    answer([[/FROM users u/, { rows: [userRow()] }]]);

    const response = await request(app)
      .patch(`/api/users/${USER_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ employeeId: null });

    expect(response.status).toBe(400);
  });

  it('không tìm thấy → 404; body rỗng → 400', async () => {
    answer([[/FROM users u/, { rows: [] }]]);

    expect(
      (await request(app).patch(`/api/users/${USER_ID}`).set('Authorization', `Bearer ${adminToken()}`).send({ role: 'HR_STAFF' }))
        .status
    ).toBe(404);
    expect(
      (await request(app).patch(`/api/users/${USER_ID}`).set('Authorization', `Bearer ${adminToken()}`).send({})).status
    ).toBe(400);
  });
});

describe('POST /api/users/:id/reset-password', () => {
  it('đặt lại mật khẩu: 204, mã hóa, chặn phiên cũ, ghi lịch sử', async () => {
    const oldToken = tokenFor('EMPLOYEE', USER_ID);
    let updateParams;
    answer([
      [/UPDATE users SET password_hash/, (params) => { updateParams = params; return { rows: [{ id: USER_ID, is_active: true }] }; }],
      [/INSERT INTO audit_logs/, { rows: [] }]
    ]);

    const response = await request(app)
      .post(`/api/users/${USER_ID}/reset-password`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ newPassword: 'Moi12345' });

    expect(response.status).toBe(204);
    expect(updateParams[0]).toMatch(/^\$2[aby]\$/);
    expect(query.mock.calls.some(([sql, params]) => /INSERT INTO audit_logs/.test(sql) && params[2] === 'PASSWORD_RESET')).toBe(true);
    expect((await request(app).get('/api/ping').set('Authorization', `Bearer ${oldToken}`)).status).toBe(401);
  });

  it('tự đặt lại mật khẩu của mình → 409; không tìm thấy → 404', async () => {
    expect(
      (await request(app)
        .post(`/api/users/${ADMIN_ID}/reset-password`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ newPassword: 'Moi12345' })).status
    ).toBe(409);

    answer([[/UPDATE users SET password_hash/, { rows: [] }]]);
    expect(
      (await request(app)
        .post(`/api/users/${USER_ID}/reset-password`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ newPassword: 'Moi12345' })).status
    ).toBe(404);
  });
});

describe('POST /api/users/bulk', () => {
  const E = (n) => `5555555${n}-5555-4555-8555-555555555555`;

  it('cấp tài khoản cho hồ sơ hợp lệ, bỏ qua và ghi lý do cho hồ sơ không cấp được', async () => {
    const inserts = [];
    answer([
      [/WHERE e.id = ANY/, {
        rows: [
          { id: E(1), employee_code: 'EMP101', full_name: 'Người Một', email: 'Mot@WebHR.local', status: 'ACTIVE', linked_user_id: null, email_user_id: null },
          { id: E(2), employee_code: 'EMP102', full_name: 'Đã Có', email: 'hai@webhr.local', status: 'ACTIVE', linked_user_id: USER_ID, email_user_id: USER_ID },
          { id: E(3), employee_code: 'EMP103', full_name: 'Nghỉ Việc', email: 'ba@webhr.local', status: 'RESIGNED', linked_user_id: null, email_user_id: null },
          { id: E(4), employee_code: 'EMP104', full_name: 'Không Email', email: null, status: 'ACTIVE', linked_user_id: null, email_user_id: null },
          { id: E(5), employee_code: 'EMP105', full_name: 'Trùng Email', email: 'admin@webhr.local', status: 'ON_LEAVE', linked_user_id: null, email_user_id: ADMIN_ID }
        ]
      }],
      [/INSERT INTO users/, (params) => { inserts.push(params); return { rows: [{ id: USER_ID }] }; }],
      [/INSERT INTO audit_logs/, { rows: [] }]
    ]);

    const response = await request(app)
      .post('/api/users/bulk')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ employeeIds: [E(1), E(2), E(3), E(4), E(5), E(6), E(1)] });

    expect(response.status).toBe(200);
    const { created, skipped } = response.body.data;
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ email: 'mot@webhr.local', employeeCode: 'EMP101', fullName: 'Người Một' });
    expect(created[0].password).toMatch(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{10}$/);
    expect(inserts[0][1]).toMatch(/^\$2[aby]\$/);
    expect(inserts[0][1]).not.toBe(created[0].password);
    expect(inserts[0].slice(2)).toEqual(['Người Một', E(1)]);
    expect(Object.fromEntries(skipped.map((s) => [s.employeeId, s.reason]))).toEqual({
      [E(2)]: 'ALREADY_LINKED',
      [E(3)]: 'EMPLOYEE_NOT_WORKING',
      [E(4)]: 'NO_EMAIL',
      [E(5)]: 'EMAIL_TAKEN',
      [E(6)]: 'EMPLOYEE_NOT_FOUND'
    });
  });

  it('trùng khi tạo cùng lúc (23505) → bỏ qua hồ sơ đó, không lỗi cả lô', async () => {
    answer([
      [/WHERE e.id = ANY/, { rows: [{ id: E(1), employee_code: 'EMP101', full_name: 'A', email: 'a@webhr.local', status: 'ACTIVE', linked_user_id: null, email_user_id: null }] }],
      [/INSERT INTO users/, () => { throw Object.assign(new Error('duplicate'), { code: '23505', constraint: 'users_employee_id_key' }); }]
    ]);

    const response = await request(app)
      .post('/api/users/bulk')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ employeeIds: [E(1)] });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ created: [], skipped: [{ employeeId: E(1), employeeCode: 'EMP101', fullName: 'A', reason: 'ALREADY_LINKED' }] });
  });

  it('danh sách rỗng hoặc quá 100 → 400; không phải Admin → 403', async () => {
    const send = (body, token = adminToken()) => request(app).post('/api/users/bulk').set('Authorization', `Bearer ${token}`).send(body);

    expect((await send({ employeeIds: [] })).status).toBe(400);
    expect((await send({ employeeIds: Array.from({ length: 101 }, () => E(1)) })).status).toBe(400);
    expect((await send({ employeeIds: [E(1)] }, tokenFor('HR_MANAGER', USER_ID))).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
