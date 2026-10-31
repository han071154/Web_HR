import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config.js';

// HR-034: thông báo trong ứng dụng (/api/notifications).
vi.mock('../../db.js', () => ({ query: vi.fn(), pool: {} }));

const { query } = await import('../../db.js');
const { requireAuth } = await import('../../middleware/auth.js');
const { default: notificationsRouter } = await import('../notifications.routes.js');
const { notifyEmployee } = await import('../../utils/notifications.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', requireAuth, notificationsRouter);
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.name === 'ZodError' ? 400 : 500);
    res.status(status).json({ message: error.name === 'ZodError' ? 'Validation error' : error.message });
  });
  return app;
}

function tokenFor(role, sub = 'user-1') {
  return jwt.sign({ sub, email: 'u@webhr.local', fullName: 'Test User', role }, config.jwtSecret);
}

const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';

describe('/api/notifications', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects requests without a token', async () => {
    const response = await request(app).get('/api/notifications/me');

    expect(response.status).toBe(401);
  });

  it('lists only the caller\'s notifications with the unread count', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: NOTIFICATION_ID,
            type: 'LEAVE_APPROVED',
            title: 'Đơn nghỉ phép đã được duyệt',
            message: 'x',
            entity_type: 'LEAVE_REQUEST',
            entity_id: 'leave-1',
            is_read: false,
            created_at: '2026-10-20T00:00:00.000Z',
            read_at: null
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] });

    const response = await request(app)
      .get('/api/notifications/me?unreadOnly=true&limit=5')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE', 'user-9')}`);

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ unreadCount: 1 });
    expect(response.body.data[0]).toMatchObject({ type: 'LEAVE_APPROVED', isRead: false, entityId: 'leave-1' });
    expect(query.mock.calls[0][1]).toEqual(['user-9', true, 5]);
    expect(query.mock.calls[1][1]).toEqual(['user-9']);
  });

  it('rejects an out-of-range limit', async () => {
    const response = await request(app)
      .get('/api/notifications/me?limit=500')
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(400);
  });

  it('returns 404 when marking someone else\'s notification as read', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch(`/api/notifications/${NOTIFICATION_ID}/read`)
      .set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);

    expect(response.status).toBe(404);
    expect(query.mock.calls[0][1]).toEqual([NOTIFICATION_ID, 'user-1']);
  });

  it('marks all own notifications as read', async () => {
    query.mockResolvedValueOnce({ rowCount: 3 });

    const response = await request(app)
      .post('/api/notifications/me/read-all')
      .set('Authorization', `Bearer ${tokenFor('HR_STAFF')}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ updated: 3 });
  });
});

describe('notifyEmployee', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('sends the notification to the account linked to the employee', async () => {
    query.mockResolvedValueOnce({ rowCount: 1 });

    await notifyEmployee({ employeeId: 'emp-1', type: 'LEAVE_APPROVED', title: 't', message: 'm', entityType: 'LEAVE_REQUEST', entityId: 'leave-1' });

    expect(query.mock.calls[0][0]).toMatch(/FROM users WHERE employee_id = \$1/);
    expect(query.mock.calls[0][1]).toEqual(['emp-1', 'LEAVE_APPROVED', 't', 'm', 'LEAVE_REQUEST', 'leave-1']);
  });

  it('does not throw when the insert fails', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    query.mockRejectedValueOnce(new Error('db down'));

    await expect(notifyEmployee({ employeeId: 'emp-1', type: 'LEAVE_REJECTED', title: 't', message: 'm' })).resolves.toBeUndefined();
    expect(stderr).toHaveBeenCalled();
    stderr.mockRestore();
  });
});
