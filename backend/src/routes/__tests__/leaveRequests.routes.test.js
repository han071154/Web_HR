import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config.js';

// Task Tuần 6: unit test cho API nghỉ phép (/api/leave-requests).
vi.mock('../../db.js', () => ({ query: vi.fn(), pool: {} }));

const { query } = await import('../../db.js');
const { requireAuth } = await import('../../middleware/auth.js');
const { default: leaveRequestsRouter } = await import('../leaveRequests.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/leave-requests', requireAuth, leaveRequestsRouter);
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.name === 'ZodError' ? 400 : 500);
    res.status(status).json({ message: error.name === 'ZodError' ? 'Validation error' : error.message });
  });
  return app;
}

function tokenFor(role) {
  return jwt.sign({ sub: 'user-1', email: 'u@webhr.local', fullName: 'Test User', role }, config.jwtSecret);
}

describe('POST /api/leave-requests', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects requests without a token', async () => {
    const response = await request(app).post('/api/leave-requests').send({});

    expect(response.status).toBe(401);
  });

  it('rejects an end date before the start date', async () => {
    query.mockResolvedValueOnce({ rows: [{ employee_id: 'emp-1' }] });

    const response = await request(app)
      .post('/api/leave-requests')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`)
      .send({ leaveType: 'ANNUAL', startDate: '2026-10-12', endDate: '2026-10-10' });

    expect(response.status).toBe(400);
  });

  it('creates a pending leave request', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ employee_id: 'emp-1' }] }) // getOwnEmployeeId
      .mockResolvedValueOnce({ rows: [{ id: 'leave-1' }] }) // insert
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'leave-1',
            employee_id: 'emp-1',
            employee_code: 'EMP002',
            employee_name: 'Tran Quoc Bao',
            department_id: 'dept-1',
            department_name: 'Engineering',
            leave_type: 'ANNUAL',
            start_date: '2026-10-12',
            end_date: '2026-10-13',
            reason: null,
            status: 'PENDING',
            approved_by: null,
            reviewed_by_name: null,
            approved_at: null,
            created_at: '2026-10-01T00:00:00.000Z',
            updated_at: '2026-10-01T00:00:00.000Z'
          }
        ]
      }) // reselect
      .mockResolvedValueOnce({ rows: [] }); // audit log

    const response = await request(app)
      .post('/api/leave-requests')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`)
      .send({ leaveType: 'ANNUAL', startDate: '2026-10-12', endDate: '2026-10-13' });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ status: 'PENDING', leaveType: 'ANNUAL' });
  });
});

describe('PATCH /api/leave-requests/:id', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects non-HR roles', async () => {
    const response = await request(app)
      .patch('/api/leave-requests/leave-1')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`)
      .send({ status: 'APPROVED' });

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns 404 when the leave request does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch('/api/leave-requests/missing-id')
      .set('Authorization', `Bearer ${tokenFor('HR_MANAGER')}`)
      .send({ status: 'APPROVED' });

    expect(response.status).toBe(404);
  });

  it('rejects reviewing a request that is already decided', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'leave-1', status: 'APPROVED' }] });

    const response = await request(app)
      .patch('/api/leave-requests/leave-1')
      .set('Authorization', `Bearer ${tokenFor('HR_MANAGER')}`)
      .send({ status: 'REJECTED' });

    expect(response.status).toBe(409);
  });
});
