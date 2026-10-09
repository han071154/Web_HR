import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config.js';

// Task Tuần 5: unit test cho API lịch phân ca (/api/work-schedules), bao gồm tự-phục vụ
// (EMPLOYEE) và yêu cầu đổi ca.
vi.mock('../../db.js', () => ({ query: vi.fn(), pool: {} }));

const { query } = await import('../../db.js');
const { requireAuth } = await import('../../middleware/auth.js');
const { default: workSchedulesRouter } = await import('../workSchedules.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/work-schedules', requireAuth, workSchedulesRouter);
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.name === 'ZodError' ? 400 : 500);
    res.status(status).json({ message: error.name === 'ZodError' ? 'Validation error' : error.message });
  });
  return app;
}

function tokenFor(role) {
  return jwt.sign({ sub: 'user-1', email: 'u@webhr.local', fullName: 'Test User', role }, config.jwtSecret);
}

describe('GET /api/work-schedules/me', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects requests without a token', async () => {
    const response = await request(app).get('/api/work-schedules/me');

    expect(response.status).toBe(401);
  });

  it('returns 409 when the account is not linked to an employee profile', async () => {
    query.mockResolvedValueOnce({ rows: [{ employee_id: null }] });

    const response = await request(app)
      .get('/api/work-schedules/me')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(409);
  });

  it('returns the own schedule when linked to an employee', async () => {
    query.mockResolvedValueOnce({ rows: [{ employee_id: 'emp-1' }] });
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'sched-1',
          employee_id: 'emp-1',
          employee_code: 'EMP002',
          employee_name: 'Tran Quoc Bao',
          department_id: 'dept-1',
          department_name: 'Engineering',
          shift_id: 'shift-1',
          shift_code: 'SHIFT-HANHCHINH',
          shift_name: 'Ca hành chính',
          start_time: '08:00:00',
          end_time: '17:00:00',
          break_minutes: 60,
          work_date: '2026-10-12',
          status: 'SCHEDULED',
          notes: null,
          created_at: '2026-10-01T00:00:00.000Z',
          updated_at: '2026-10-01T00:00:00.000Z'
        }
      ]
    });

    const response = await request(app)
      .get('/api/work-schedules/me')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({ employeeCode: 'EMP002', shiftCode: 'SHIFT-HANHCHINH' });
  });
});

describe('GET /api/work-schedules (HR)', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects non-HR roles', async () => {
    const response = await request(app)
      .get('/api/work-schedules')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('allows HR_STAFF to list schedules', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get('/api/work-schedules')
      .set('Authorization', `Bearer ${tokenFor('HR_STAFF')}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
});

describe('POST /api/work-schedules (HR)', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('validates the request body', async () => {
    const response = await request(app)
      .post('/api/work-schedules')
      .set('Authorization', `Bearer ${tokenFor('ADMIN')}`)
      .send({ employeeId: 'not-a-uuid', shiftId: 'shift-1', workDate: '2026-10-12' });

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('creates a schedule when there is no conflict and the weekly limit is respected', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // ensureNoScheduleConflict: no existing row
      .mockResolvedValueOnce({ rows: [{ hours: 8 }] }) // getShiftHours
      .mockResolvedValueOnce({ rows: [{ hours: 0 }] }) // weekly sum so far
      .mockResolvedValueOnce({ rows: [{ id: 'sched-1' }] }) // insert
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'sched-1',
            employee_id: '11111111-1111-1111-1111-111111111111',
            employee_code: 'EMP002',
            employee_name: 'Tran Quoc Bao',
            department_id: 'dept-1',
            department_name: 'Engineering',
            shift_id: '22222222-2222-2222-2222-222222222222',
            shift_code: 'SHIFT-HANHCHINH',
            shift_name: 'Ca hành chính',
            start_time: '08:00:00',
            end_time: '17:00:00',
            break_minutes: 60,
            work_date: '2026-10-12',
            status: 'SCHEDULED',
            notes: null,
            created_at: '2026-10-01T00:00:00.000Z',
            updated_at: '2026-10-01T00:00:00.000Z'
          }
        ]
      }) // reselect created row
      .mockResolvedValueOnce({ rows: [] }); // logAudit insert

    const response = await request(app)
      .post('/api/work-schedules')
      .set('Authorization', `Bearer ${tokenFor('ADMIN')}`)
      .send({
        employeeId: '11111111-1111-1111-1111-111111111111',
        shiftId: '22222222-2222-2222-2222-222222222222',
        workDate: '2026-10-12'
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ employeeCode: 'EMP002', status: 'SCHEDULED' });
  });

  it('rejects a shift that would exceed the weekly hour limit', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // no conflict
      .mockResolvedValueOnce({ rows: [{ hours: 10 }] }) // getShiftHours: new shift is 10h
      .mockResolvedValueOnce({ rows: [{ hours: 45 }] }); // already 45h this week -> 55h > 48h limit

    const response = await request(app)
      .post('/api/work-schedules')
      .set('Authorization', `Bearer ${tokenFor('ADMIN')}`)
      .send({
        employeeId: '11111111-1111-1111-1111-111111111111',
        shiftId: '22222222-2222-2222-2222-222222222222',
        workDate: '2026-10-12'
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/Weekly work hour limit exceeded/);
  });
});

describe('PATCH /api/work-schedules/change-requests/:id', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('returns 404 when the request does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch('/api/work-schedules/change-requests/missing-id')
      .set('Authorization', `Bearer ${tokenFor('HR_MANAGER')}`)
      .send({ status: 'APPROVED' });

    expect(response.status).toBe(404);
  });

  it('returns 409 when the request was already reviewed', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'req-1', status: 'APPROVED' }] });

    const response = await request(app)
      .patch('/api/work-schedules/change-requests/req-1')
      .set('Authorization', `Bearer ${tokenFor('HR_MANAGER')}`)
      .send({ status: 'REJECTED' });

    expect(response.status).toBe(409);
  });
});
