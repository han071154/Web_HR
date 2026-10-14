import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config.js';

// Task #67: unit test cho API Auth. Mock tầng DB để test chỉ chạy logic của route,
// không cần PostgreSQL thật (khác với backend/scripts/smokeTest.js và tests/postman
// vốn là integration test gọi API thật trên server + DB thật).
vi.mock('../../db.js', () => ({ query: vi.fn(), pool: {} }));

const { query } = await import('../../db.js');
const { default: authRouter } = await import('../auth.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.name === 'ZodError' ? 400 : 500);
    res.status(status).json({ message: error.name === 'ZodError' ? 'Validation error' : error.message });
  });
  return app;
}

const PASSWORD = 'secret123';

async function activeUserRow(overrides = {}) {
  return {
    id: 'user-1',
    email: 'admin@webhr.local',
    password_hash: await bcrypt.hash(PASSWORD, 4),
    full_name: 'Web HR Admin',
    role: 'ADMIN',
    is_active: true,
    ...overrides
  };
}

describe('POST /api/auth/login', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('returns an access token, a refresh token and the user on valid credentials', async () => {
    const user = await activeUserRow();
    query.mockResolvedValueOnce({ rows: [user] });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.user).toEqual({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role
    });

    const decoded = jwt.verify(response.body.token, config.jwtSecret);
    expect(decoded.sub).toBe(user.id);
    expect(decoded.role).toBe(user.role);
  });

  it('rejects an incorrect password', async () => {
    const user = await activeUserRow();
    query.mockResolvedValueOnce({ rows: [user] });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Email or password is incorrect');
  });

  it('rejects an unknown email without revealing whether the account exists', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@webhr.local', password: PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Email or password is incorrect');
  });

  it('rejects a deactivated account even with the correct password', async () => {
    const user = await activeUserRow({ is_active: false });
    query.mockResolvedValueOnce({ rows: [user] });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Email or password is incorrect');
  });

  it('validates the request body', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/me', () => {
  const app = createApp();

  it('rejects requests without a token', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
  });

  it('returns the user decoded from a valid token', async () => {
    const token = jwt.sign({ sub: 'user-1', email: 'admin@webhr.local', role: 'ADMIN' }, config.jwtSecret);

    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ sub: 'user-1', role: 'ADMIN' });
  });
});

describe('POST /api/auth/refresh', () => {
  const app = createApp();

  beforeEach(() => {
    query.mockReset();
  });

  it('issues a new access token for a valid refresh token', async () => {
    const user = await activeUserRow();
    const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, config.jwtRefreshSecret, {
      expiresIn: '30d'
    });
    query.mockResolvedValueOnce({ rows: [user] });

    const response = await request(app).post('/api/auth/refresh').send({ refreshToken });

    expect(response.status).toBe(200);
    const decoded = jwt.verify(response.body.token, config.jwtSecret);
    expect(decoded.sub).toBe(user.id);
  });

  it('rejects a token that is not a refresh token (e.g. an access token)', async () => {
    const accessToken = jwt.sign({ sub: 'user-1' }, config.jwtRefreshSecret);

    const response = await request(app).post('/api/auth/refresh').send({ refreshToken: accessToken });

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects a refresh token signed with the wrong secret', async () => {
    const forged = jwt.sign({ sub: 'user-1', type: 'refresh' }, 'not-the-real-secret');

    const response = await request(app).post('/api/auth/refresh').send({ refreshToken: forged });

    expect(response.status).toBe(401);
  });

  it('rejects a refresh token for a deactivated account', async () => {
    const user = await activeUserRow({ is_active: false });
    const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, config.jwtRefreshSecret);
    query.mockResolvedValueOnce({ rows: [user] });

    const response = await request(app).post('/api/auth/refresh').send({ refreshToken });

    expect(response.status).toBe(401);
  });

  it('rejects refresh tokens issued before the password was changed (HR-027)', async () => {
    const oldRefresh = jwt.sign({ sub: 'user-1', type: 'refresh', iat: Math.floor(Date.now() / 1000) - 3600 }, config.jwtRefreshSecret);
    query.mockResolvedValueOnce({ rows: [await activeUserRow({ password_changed_at: new Date(Date.now() - 60000) })] });

    const response = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });

    expect(response.status).toBe(401);
  });
});

describe('POST /api/auth/change-password (HR-027)', () => {
  const app = createApp();
  const token = () =>
    jwt.sign({ sub: 'user-1', email: 'admin@webhr.local', fullName: 'Web HR Admin', role: 'ADMIN' }, config.jwtSecret);

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects requests without a token', async () => {
    const response = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'NewPass123' });

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects a wrong current password without changing anything', async () => {
    query.mockResolvedValueOnce({ rows: [await activeUserRow()] });

    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token()}`)
      .send({ currentPassword: 'wrongPass1', newPassword: 'NewPass123' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Current password is incorrect');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects weak new passwords (too short, no number, no letter)', async () => {
    for (const newPassword of ['Ab1', 'onlyletters', '12345678']) {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token()}`)
        .send({ currentPassword: PASSWORD, newPassword });

      expect(response.status).toBe(400);
    }

    expect(query).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    query.mockResolvedValueOnce({ rows: [await activeUserRow({ password_hash: await bcrypt.hash('SamePass123', 4) })] });

    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token()}`)
      .send({ currentPassword: 'SamePass123', newPassword: 'SamePass123' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('New password must be different from the current password');
  });

  it('stores a bcrypt hash of the new password and returns fresh tokens', async () => {
    query
      .mockResolvedValueOnce({ rows: [await activeUserRow()] })
      .mockResolvedValueOnce({ rows: [] }) // UPDATE users
      .mockResolvedValueOnce({ rows: [] }); // audit log

    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token()}`)
      .send({ currentPassword: PASSWORD, newPassword: 'NewPass123' });

    expect(response.status).toBe(200);
    expect(jwt.verify(response.body.token, config.jwtSecret).sub).toBe('user-1');
    expect(jwt.verify(response.body.refreshToken, config.jwtRefreshSecret).type).toBe('refresh');
    const [sql, [hash, id]] = query.mock.calls[1];
    expect(sql).toMatch(/UPDATE users SET password_hash/);
    expect(id).toBe('user-1');
    expect(await bcrypt.compare('NewPass123', hash)).toBe(true);
  });
});
