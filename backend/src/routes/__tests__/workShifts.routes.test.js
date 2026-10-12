import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config.js';

// Task Tuần 5: unit test cho API quản lý loại ca làm việc (/api/work-shifts).
vi.mock('../../db.js', () => ({ query: vi.fn(), pool: {} }));

const { query } = await import('../../db.js');
const { requireAuth } = await import('../../middleware/auth.js');
const { default: workShiftsRouter } = await import('../workShifts.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/work-shifts', requireAuth, workShiftsRouter);
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.name === 'ZodError' ? 400 : 500);
    res.status(status).json({ message: error.name === 'ZodError' ? 'Validation error' : error.message });
  });
  return app;
}

function tokenFor(role) {
  return jwt.sign({ sub: 'user-1', email: 'u@webhr.local', fullName: 'Test User', role }, config.jwtSecret);
}

describe('GET /api/work-shifts', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects requests without a token', async () => {
    const response = await request(app).get('/api/work-shifts');

    expect(response.status).toBe(401);
  });

  it('returns the shift list for any authenticated role', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'shift-1',
          code: 'SHIFT-SANG',
          name: 'Ca sáng',
          start_time: '08:00:00',
          end_time: '12:00:00',
          break_minutes: 0,
          is_active: true,
          created_at: '2026-10-01T00:00:00.000Z',
          updated_at: '2026-10-01T00:00:00.000Z'
        }
      ]
    });

    const response = await request(app)
      .get('/api/work-shifts')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ code: 'SHIFT-SANG', breakMinutes: 0 });
  });
});

describe('POST /api/work-shifts', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects non-HR roles', async () => {
    const response = await request(app)
      .post('/api/work-shifts')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`)
      .send({ code: 'SHIFT-X', name: 'Ca X', startTime: '08:00', endTime: '12:00' });

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects an end time that is not after the start time', async () => {
    const response = await request(app)
      .post('/api/work-shifts')
      .set('Authorization', `Bearer ${tokenFor('ADMIN')}`)
      .send({ code: 'SHIFT-X', name: 'Ca X', startTime: '12:00', endTime: '08:00' });

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('creates a shift with default break minutes and active status', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'shift-1',
          code: 'SHIFT-X',
          name: 'Ca X',
          start_time: '08:00:00',
          end_time: '12:00:00',
          break_minutes: 0,
          is_active: true,
          created_at: '2026-10-01T00:00:00.000Z',
          updated_at: '2026-10-01T00:00:00.000Z'
        }
      ]
    });

    const response = await request(app)
      .post('/api/work-shifts')
      .set('Authorization', `Bearer ${tokenFor('ADMIN')}`)
      .send({ code: 'SHIFT-X', name: 'Ca X', startTime: '08:00', endTime: '12:00' });

    expect(response.status).toBe(201);
    expect(query.mock.calls[0][1]).toEqual(['SHIFT-X', 'Ca X', '08:00', '12:00', 0, true]);
  });
});

describe('DELETE /api/work-shifts/:id', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('refuses to delete a shift already used in a schedule', async () => {
    query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const response = await request(app)
      .delete('/api/work-shifts/shift-1')
      .set('Authorization', `Bearer ${tokenFor('ADMIN')}`);

    expect(response.status).toBe(409);
  });
});
