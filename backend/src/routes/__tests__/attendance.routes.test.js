import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// Máy chủ chạy giờ UTC nhưng công ty ở Việt Nam (UTC+7): ngày chấm công và giờ đi trễ phải tính
// theo giờ Việt Nam. Chỉ giả lập Date (không giả lập timer để supertest vẫn chạy bình thường).
describe('POST /api/attendance-records/check-in uses the company timezone', () => {
  const app = createApp();
  const attendanceRow = {
    id: 'att-1',
    employee_id: 'emp-1',
    employee_code: 'EMP002',
    employee_name: 'Tran Quoc Bao',
    work_date: '2026-10-10',
    status: 'PRESENT'
  };

  beforeEach(() => {
    query.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records 01:30 in Vietnam on the Vietnamese date, not the UTC date', async () => {
    vi.setSystemTime(new Date('2026-10-09T18:30:00Z')); // 01:30 ngày 10/10 giờ Việt Nam
    query
      .mockResolvedValueOnce({ rows: [{ employee_id: 'emp-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'att-1' }] })
      .mockResolvedValueOnce({ rows: [attendanceRow] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post('/api/attendance-records/check-in')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(201);
    expect(query.mock.calls[1][1]).toEqual(['emp-1', '2026-10-10']);
    expect(query.mock.calls[2][1]).toEqual(['emp-1', '2026-10-10']);
  });

  it('marks LATE from the Vietnamese clock time, not the server clock', async () => {
    vi.setSystemTime(new Date('2026-10-12T01:20:00Z')); // 08:20 giờ Việt Nam, ca bắt đầu 08:00
    query
      .mockResolvedValueOnce({ rows: [{ employee_id: 'emp-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'schedule-1', start_time: '08:00:00' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'att-1' }] })
      .mockResolvedValueOnce({ rows: [{ ...attendanceRow, work_date: '2026-10-12', status: 'LATE' }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post('/api/attendance-records/check-in')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(201);
    expect(query.mock.calls[3][1]).toEqual(['emp-1', 'schedule-1', '2026-10-12', 'LATE']);
  });

  it('keeps 08:10 in Vietnam within the late threshold', async () => {
    vi.setSystemTime(new Date('2026-10-12T01:10:00Z')); // 08:10 giờ Việt Nam
    query
      .mockResolvedValueOnce({ rows: [{ employee_id: 'emp-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'schedule-1', start_time: '08:00:00' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'att-1' }] })
      .mockResolvedValueOnce({ rows: [{ ...attendanceRow, work_date: '2026-10-12' }] })
      .mockResolvedValueOnce({ rows: [] });

    await request(app)
      .post('/api/attendance-records/check-in')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(query.mock.calls[3][1][3]).toBe('PRESENT');
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

  it('includes the last day of the month', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get('/api/attendance-records/monthly-summary?month=2026-09')
      .set('Authorization', `Bearer ${tokenFor('HR_STAFF')}`);

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ month: '2026-09', from: '2026-09-01', to: '2026-09-30' });
    expect(query.mock.calls[0][1].slice(0, 2)).toEqual(['2026-09-01', '2026-09-30']);
  });

  it('validates the month format', async () => {
    const response = await request(app)
      .get('/api/attendance-records/monthly-summary?month=2026/10')
      .set('Authorization', `Bearer ${tokenFor('HR_STAFF')}`);

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
