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
    expect(query.mock.calls[3][1]).toEqual(['emp-1', 'schedule-1', '2026-10-12', 'LATE', 20]);
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
    expect(query.mock.calls[3][1][4]).toBe(0);
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

// HR-035: về sớm so với giờ kết thúc ca.
describe('POST /api/attendance-records/check-out (early leave)', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockCheckOut() {
    query
      .mockResolvedValueOnce({ rows: [{ employee_id: 'emp-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'att-1', schedule_id: 'schedule-1', check_in: '2026-10-12T01:00:00Z', check_out: null }] })
      .mockResolvedValueOnce({ rows: [{ end_time: '17:00:00' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'att-1', work_date: '2026-10-12', early_leave_minutes: 30 }] })
      .mockResolvedValueOnce({ rows: [] });
  }

  it('records the minutes left before the end of the shift', async () => {
    vi.setSystemTime(new Date('2026-10-12T09:30:00Z')); // 16:30 giờ Việt Nam, ca kết thúc 17:00
    mockCheckOut();

    const response = await request(app)
      .post('/api/attendance-records/check-out')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(200);
    expect(query.mock.calls[3][1]).toEqual([30, 'att-1']);
    expect(response.body.data.earlyLeaveMinutes).toBe(30);
  });

  it('does not count leaving within the threshold', async () => {
    vi.setSystemTime(new Date('2026-10-12T09:50:00Z')); // 16:50 giờ Việt Nam
    mockCheckOut();

    await request(app)
      .post('/api/attendance-records/check-out')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(query.mock.calls[3][1]).toEqual([0, 'att-1']);
  });
});

// HR-035: ghi Vắng cho ca đã xếp mà không chấm công.
describe('POST /api/attendance-records/mark-absent', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects non-HR roles', async () => {
    const response = await request(app)
      .post('/api/attendance-records/mark-absent')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`)
      .send({ date: '2026-10-12' });

    expect(response.status).toBe(403);
  });

  it('rejects today or a future date', async () => {
    vi.setSystemTime(new Date('2026-10-12T03:00:00Z'));

    const response = await request(app)
      .post('/api/attendance-records/mark-absent')
      .set('Authorization', `Bearer ${tokenFor('HR_STAFF')}`)
      .send({ date: '2026-10-12' });

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('marks scheduled shifts without attendance as ABSENT', async () => {
    vi.setSystemTime(new Date('2026-10-12T03:00:00Z'));
    query.mockResolvedValueOnce({ rowCount: 4 }).mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post('/api/attendance-records/mark-absent')
      .set('Authorization', `Bearer ${tokenFor('HR_MANAGER')}`)
      .send({ date: '2026-10-11' });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ date: '2026-10-11', created: 4 });
    expect(query.mock.calls[0][0]).toMatch(/'ABSENT'[\s\S]*ws.status = 'SCHEDULED'[\s\S]*ON CONFLICT \(employee_id, work_date\) DO NOTHING/);
    expect(query.mock.calls[0][1]).toEqual(['2026-10-11']);
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

describe('PUT /api/attendance-records/:id (HR correction)', () => {
  const app = createApp();
  const record = { id: 'att-1', employee_id: 'emp-1', work_date: '2026-10-12', check_in: null, check_out: null, status: 'PRESENT', note: null };

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects a check-out before the check-in', async () => {
    query.mockResolvedValueOnce({ rows: [record] });

    const response = await request(app)
      .put('/api/attendance-records/att-1')
      .set('Authorization', `Bearer ${tokenFor('HR_STAFF')}`)
      .send({ checkIn: '2026-10-12T17:00:00+07:00', checkOut: '2026-10-12T08:00:00+07:00' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Check-out must be after check-in');
  });

  it('rejects times on a different day than the attendance date (Vietnam time)', async () => {
    query.mockResolvedValueOnce({ rows: [record] });

    // 2026-10-12T18:00Z là 01:00 ngày 13/10 ở Việt Nam.
    const response = await request(app)
      .put('/api/attendance-records/att-1')
      .set('Authorization', `Bearer ${tokenFor('HR_STAFF')}`)
      .send({ checkIn: '2026-10-12T08:00:00+07:00', checkOut: '2026-10-12T18:00:00Z' });

    expect(response.status).toBe(400);
  });

  it('rejects a month that does not exist', async () => {
    const response = await request(app)
      .get('/api/attendance-records/monthly-summary?month=2026-13')
      .set('Authorization', `Bearer ${tokenFor('HR_STAFF')}`);

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
