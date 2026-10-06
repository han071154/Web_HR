import rateLimit from 'express-rate-limit';

// OWASP A07 (Identification and Authentication Failures): chặn dò mật khẩu bằng cách
// giới hạn số lần gọi /auth/login và /auth/refresh theo IP trong một khoảng thời gian.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later' }
});
