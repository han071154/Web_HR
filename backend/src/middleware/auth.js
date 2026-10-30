import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { httpError } from '../utils/httpError.js';
import { isTokenRevoked } from '../utils/sessionRevocation.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return next(httpError(401, 'Missing authorization token'));
  }

  let payload;

  try {
    payload = jwt.verify(header.slice('Bearer '.length), config.jwtSecret);
  } catch {
    return next(httpError(401, 'Invalid or expired token'));
  }

  // Tài khoản bị khóa / đổi vai trò / đặt lại mật khẩu sau khi token được cấp (HR-007).
  if (isTokenRevoked(payload)) {
    return next(httpError(401, 'Invalid or expired token'));
  }

  req.user = payload;
  return next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(httpError(403, 'You do not have permission to perform this action'));
    }

    return next();
  };
}
