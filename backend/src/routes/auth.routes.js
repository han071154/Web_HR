import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, passwordChangeLimiter } from '../middleware/rateLimit.js';
import { logAudit } from '../utils/audit.js';
import { httpError } from '../utils/httpError.js';
import { revokeSessions } from '../utils/sessionRevocation.js';
import { passwordSchema } from '../utils/validation.js';

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema
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
      'SELECT id, email, full_name, role, is_active, password_changed_at FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = result.rows[0];

    if (!user || !user.is_active) {
      throw httpError(401, 'Invalid or expired refresh token');
    }

    // Đã đổi mật khẩu sau khi cấp refresh token này → phiên cũ hết hiệu lực (iat tính bằng giây).
    if (user.password_changed_at && payload.iat * 1000 < new Date(user.password_changed_at).getTime()) {
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

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Đổi mật khẩu của chính tài khoản đang đăng nhập (HR-027)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8, maxLength: 72, description: 'Có cả chữ và số' }
 *     responses:
 *       200: { description: Đã đổi mật khẩu; trả token và refreshToken mới cho phiên hiện tại }
 *       400: { description: Mật khẩu cũ sai hoặc mật khẩu mới không hợp lệ }
 *       401: { description: Chưa đăng nhập }
 */
// Giới hạn riêng theo tài khoản (passwordChangeLimiter) để không dò được mật khẩu hiện tại qua API này.
router.post('/change-password', requireAuth, passwordChangeLimiter, async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const result = await query('SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE id = $1', [
      req.user.sub
    ]);
    const user = result.rows[0];

    if (!user || !user.is_active) {
      throw httpError(401, 'Invalid or expired token');
    }

    if (!(await bcrypt.compare(body.currentPassword, user.password_hash))) {
      throw httpError(400, 'Current password is incorrect');
    }

    if (body.newPassword === body.currentPassword) {
      throw httpError(400, 'New password must be different from the current password');
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    // Lùi 1 giây: token mới cấp ngay bên dưới có iat (giây, làm tròn xuống) không bị coi là "trước khi đổi".
    await query(
      `UPDATE users SET password_hash = $1, password_changed_at = NOW() - INTERVAL '1 second', updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, user.id]
    );
    // Các phiên khác (máy khác) hết hiệu lực ngay, không chờ access token hết hạn.
    revokeSessions(user.id, Date.now() - 1000);
    await logAudit({ entityType: 'USER', entityId: user.id, action: 'PASSWORD_CHANGED', user: req.user });

    res.json({ token: signAccessToken(user), refreshToken: signRefreshToken(user) });
  } catch (error) {
    next(error);
  }
});

export default router;
