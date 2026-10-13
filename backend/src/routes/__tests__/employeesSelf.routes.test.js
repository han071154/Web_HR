import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config.js';

// HR-011: nhân viên tự xem hồ sơ của mình (GET /employees/me) và chỉ tự sửa SĐT, địa chỉ (PUT /employees/me).
vi.mock('../../db.js', () => ({ query: vi.fn(), pool: {} }));

const { query } = await import('../../db.js');
const { requireAuth } = await import('../../middleware/auth.js');
const { default: employeesRouter } = await import('../employees.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/employees', requireAuth, employeesRouter);
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.name === 'ZodError' ? 400 : 500);
    res.status(status).json({ message: error.name === 'ZodError' ? 'Validation error' : error.message });
  });
  return app;
}

const employeeToken = () =>
  jwt.sign({ sub: 'user-9', email: 'nv@webhr.local', fullName: 'Nhân Viên', role: 'EMPLOYEE' }, config.jwtSecret);

function employeeRow(overrides = {}) {
  return {
    id: 'emp-9',
    employee_code: 'NV009',
    full_name: 'Nhân Viên',
    email: 'nv@webhr.local',
    phone: '0901000000',
    address: 'Hà Nội',
    base_salary: '10000000',
    status: 'ACTIVE',
    avatar_url: null,
    ...overrides
  };
}

describe('GET /api/employees/me', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('returns the profile linked to the account', async () => {
    query.mockResolvedValueOnce({ rows: [{ employee_id: 'emp-9' }] }).mockResolvedValueOnce({ rows: [employeeRow()] });

    const response = await request(app).get('/api/employees/me').set('Authorization', `Bearer ${employeeToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.employeeCode).toBe('NV009');
    expect(query.mock.calls[1][1]).toEqual(['emp-9']);
  });

  it('returns 409 when the account has no linked profile', async () => {
    query.mockResolvedValueOnce({ rows: [{ employee_id: null }] });

    const response = await request(app).get('/api/employees/me').set('Authorization', `Bearer ${employeeToken()}`);

    expect(response.status).toBe(409);
  });

  it('still forbids an employee from listing other employees', async () => {
    const response = await request(app).get('/api/employees').set('Authorization', `Bearer ${employeeToken()}`);

    expect(response.status).toBe(403);
  });
});

describe('PUT /api/employees/me', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('updates phone and address and records the change in the history', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ employee_id: 'emp-9' }] })
      .mockResolvedValueOnce({ rows: [employeeRow()] }) // trước khi sửa
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [employeeRow({ phone: '0912345678', address: 'Đà Nẵng' })] }) // sau khi sửa
      .mockResolvedValueOnce({ rows: [] }); // audit log

    const response = await request(app)
      .put('/api/employees/me')
      .set('Authorization', `Bearer ${employeeToken()}`)
      .send({ phone: '0912345678', address: 'Đà Nẵng' });

    expect(response.status).toBe(200);
    expect(response.body.data.phone).toBe('0912345678');
    expect(query.mock.calls[2]).toEqual([expect.stringMatching(/UPDATE employees SET phone/), ['0912345678', 'Đà Nẵng', 'emp-9']]);
    expect(query.mock.calls[4][1][2]).toBe('SELF_UPDATED');
  });

  it('rejects any field other than phone and address (e.g. salary)', async () => {
    query.mockResolvedValueOnce({ rows: [{ employee_id: 'emp-9' }] });

    const response = await request(app)
      .put('/api/employees/me')
      .set('Authorization', `Bearer ${employeeToken()}`)
      .send({ phone: '0912345678', baseSalary: 99999999 });

    expect(response.status).toBe(400);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid phone number', async () => {
    query.mockResolvedValueOnce({ rows: [{ employee_id: 'emp-9' }] });

    const response = await request(app)
      .put('/api/employees/me')
      .set('Authorization', `Bearer ${employeeToken()}`)
      .send({ phone: 'abc' });

    expect(response.status).toBe(400);
  });
});
