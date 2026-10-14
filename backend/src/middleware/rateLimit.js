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

// Đổi mật khẩu (HR-027): đếm riêng theo tài khoản (chạy sau requireAuth nên có req.user), không dùng
// chung lượt với đăng nhập. 10 lần/15 phút đủ cho người gõ nhầm, nhưng không đủ để dò mật khẩu hiện tại.
export const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user.sub}`,
  message: { message: 'Too many password change attempts, please try again later' }
});
