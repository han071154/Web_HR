import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { httpError } from '../utils/httpError.js';

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      fullName: user.full_name ?? user.fullName,
      role: user.role
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn
  });
}

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Đăng nhập bằng email và mật khẩu
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về access token và refresh token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Access token (JWT), hết hạn theo JWT_EXPIRES_IN
 *                 refreshToken:
 *                   type: string
 *                   description: Dùng với /auth/refresh để lấy access token mới mà không cần đăng nhập lại
 *                 user:
 *                   type: object
 *       401:
 *         description: Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa
 */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await query(
      'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = $1',
      [body.email.toLowerCase()]
    );
    const user = result.rows[0];

    if (!user || !user.is_active) {
      throw httpError(401, 'Email or password is incorrect');
    }

    const passwordMatches = await bcrypt.compare(body.password, user.password_hash);

    if (!passwordMatches) {
      throw httpError(401, 'Email or password is incorrect');
    }

    res.json({
      token: signAccessToken(user),
      refreshToken: signRefreshToken(user),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Lấy access token mới bằng refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access token mới
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Refresh token không hợp lệ, đã hết hạn, hoặc tài khoản đã bị khóa
 */
router.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body);
    let payload;

    try {
      payload = jwt.verify(body.refreshToken, config.jwtRefreshSecret);
    } catch {
      throw httpError(401, 'Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw httpError(401, 'Invalid or expired refresh token');
    }

    const result = await query(
      'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = result.rows[0];

    if (!user || !user.is_active) {
      throw httpError(401, 'Invalid or expired refresh token');
    }

    res.json({ token: signAccessToken(user) });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Thông tin người dùng đang đăng nhập
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Thông tin người dùng lấy từ access token
 *       401:
 *         description: Thiếu token hoặc token không hợp lệ/đã hết hạn
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
