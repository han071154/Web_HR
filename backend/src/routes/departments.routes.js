import express from 'express';
import { query } from '../db.js';

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, description FROM departments ORDER BY name ASC'
    );

    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
