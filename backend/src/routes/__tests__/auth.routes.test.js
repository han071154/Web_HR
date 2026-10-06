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
});
