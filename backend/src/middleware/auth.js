import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { httpError } from '../utils/httpError.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return next(httpError(401, 'Missing authorization token'));
  }

  try {
    const token = header.slice('Bearer '.length);
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return next(httpError(401, 'Invalid or expired token'));
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(httpError(403, 'You do not have permission to perform this action'));
    }

    return next();
  };
}
