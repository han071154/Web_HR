import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { httpError } from '../utils/httpError.js';

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post('/login', async (req, res, next) => {
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

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    res.json({
      token,
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

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
