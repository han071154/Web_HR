import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config.js';

// Task Tuần 6: unit test cho API chấm công (/api/attendance-records).
vi.mock('../../db.js', () => ({ query: vi.fn(), pool: {} }));

const { query } = await import('../../db.js');
const { requireAuth } = await import('../../middleware/auth.js');
const { default: attendanceRouter } = await import('../attendance.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/attendance-records', requireAuth, attendanceRouter);
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.name === 'ZodError' ? 400 : 500);
    res.status(status).json({ message: error.name === 'ZodError' ? 'Validation error' : error.message });
  });
  return app;
}

function tokenFor(role) {
  return jwt.sign({ sub: 'user-1', email: 'u@webhr.local', fullName: 'Test User', role }, config.jwtSecret);
}

describe('POST /api/attendance-records/check-in', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects requests without a token', async () => {
    const response = await request(app).post('/api/attendance-records/check-in');

    expect(response.status).toBe(401);
  });

  it('returns 409 when the account is not linked to an employee profile', async () => {
    query.mockResolvedValueOnce({ rows: [{ employee_id: null }] });

    const response = await request(app)
      .post('/api/attendance-records/check-in')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(409);
  });

  it('checks in without a schedule as PRESENT', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ employee_id: 'emp-1' }] }) // getOwnEmployeeId
      .mockResolvedValueOnce({ rows: [] }) // no existing attendance today
      .mockResolvedValueOnce({ rows: [] }) // no schedule today
      .mockResolvedValueOnce({ rows: [{ id: 'att-1' }] }) // insert
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'att-1',
            employee_id: 'emp-1',
            employee_code: 'EMP002',
            employee_name: 'Tran Quoc Bao',
            department_id: 'dept-1',
            department_name: 'Engineering',
            schedule_id: null,
            shift_name: null,
            work_date: '2026-10-12',
            check_in: '2026-10-12T01:00:00.000Z',
            check_out: null,
            status: 'PRESENT',
            note: null,
            created_at: '2026-10-12T01:00:00.000Z',
            updated_at: '2026-10-12T01:00:00.000Z'
          }
        ]
      }) // reselect
      .mockResolvedValueOnce({ rows: [] }); // audit log

    const response = await request(app)
      .post('/api/attendance-records/check-in')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ status: 'PRESENT', employeeCode: 'EMP002' });
  });

  it('rejects a second check-in on the same day', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ employee_id: 'emp-1' }] })
      .mockResolvedValueOnce({ rows: [{ check_in: '2026-10-12T01:00:00.000Z' }] });

    const response = await request(app)
      .post('/api/attendance-records/check-in')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(409);
  });
});

describe('POST /api/attendance-records/check-out', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects checking out without having checked in', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ employee_id: 'emp-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post('/api/attendance-records/check-out')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(409);
  });
});

describe('GET /api/attendance-records/monthly-summary', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects non-HR roles', async () => {
    const response = await request(app)
      .get('/api/attendance-records/monthly-summary?month=2026-10')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('validates the month format', async () => {
    const response = await request(app)
      .get('/api/attendance-records/monthly-summary?month=2026/10')
      .set('Authorization', `Bearer ${tokenFor('HR_STAFF')}`);

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
