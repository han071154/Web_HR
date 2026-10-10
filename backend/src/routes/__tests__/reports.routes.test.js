import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config.js';

// Task Tuần 6: unit test cho API báo cáo thống kê (/api/reports).
vi.mock('../../db.js', () => ({ query: vi.fn(), pool: {} }));

const { query } = await import('../../db.js');
const { requireAuth } = await import('../../middleware/auth.js');
const { default: reportsRouter } = await import('../reports.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/reports', requireAuth, reportsRouter);
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.name === 'ZodError' ? 400 : 500);
    res.status(status).json({ message: error.name === 'ZodError' ? 'Validation error' : error.message });
  });
  return app;
}

function tokenFor(role) {
  return jwt.sign({ sub: 'user-1', email: 'u@webhr.local', fullName: 'Test User', role }, config.jwtSecret);
}

describe('GET /api/reports/by-department', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects non-HR roles', async () => {
    const response = await request(app)
      .get('/api/reports/by-department')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns headcount per department for HR roles', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'dept-1', name: 'Engineering', employee_count: 5 }]
    });

    const response = await request(app)
      .get('/api/reports/by-department')
      .set('Authorization', `Bearer ${tokenFor('HR_STAFF')}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      { departmentId: 'dept-1', departmentName: 'Engineering', employeeCount: 5 }
    ]);
  });
});

describe('GET /api/reports/work-hours', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('requires from/to dates', async () => {
    const response = await request(app)
      .get('/api/reports/work-hours')
      .set('Authorization', `Bearer ${tokenFor('ADMIN')}`);

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns work-hour stats for a valid range', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          employee_id: 'emp-1',
          employee_code: 'EMP002',
          employee_name: 'Tran Quoc Bao',
          work_days: 20,
          late_count: 1,
          absent_count: 0,
          total_hours: 160,
          ot_hours: 4
        }
      ]
    });

    const response = await request(app)
      .get('/api/reports/work-hours?from=2026-10-01&to=2026-10-31')
      .set('Authorization', `Bearer ${tokenFor('ADMIN')}`);

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({ employeeCode: 'EMP002', workDays: 20, otHours: 4 });
  });
});
