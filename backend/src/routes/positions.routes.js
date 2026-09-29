import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { httpError } from '../utils/httpError.js';

const router = express.Router();

const positionSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true)
});

const positionSelectSql = `
  SELECT
    p.*,
    d.name AS department_name
  FROM positions p
  LEFT JOIN departments d ON d.id = p.department_id
`;

function mapPosition(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    departmentId: row.department_id,
    departmentName: row.department_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

router.get('/', async (req, res, next) => {
  try {
    const departmentId = String(req.query.departmentId || '').trim();
    const active = String(req.query.active || '').trim();
    const values = [];
    const where = [];

    if (departmentId) {
      values.push(departmentId);
      where.push(`p.department_id = $${values.length}`);
    }

    if (active === 'true' || active === 'false') {
      values.push(active === 'true');
      where.push(`p.is_active = $${values.length}`);
    }

    const result = await query(
      `${positionSelectSql}
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY p.name ASC`,
      values
    );

    res.json({ data: result.rows.map(mapPosition) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`${positionSelectSql} WHERE p.id = $1`, [req.params.id]);

    if (!result.rows[0]) {
      throw httpError(404, 'Position not found');
    }

    res.json({ data: mapPosition(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'HR_MANAGER'), async (req, res, next) => {
  try {
    const body = positionSchema.parse(req.body);
    const result = await query(
      `INSERT INTO positions (code, name, description, department_id, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [body.code.toUpperCase(), body.name, body.description ?? null, body.departmentId ?? null, body.isActive]
    );
    const created = await query(`${positionSelectSql} WHERE p.id = $1`, [result.rows[0].id]);

    res.status(201).json({ data: mapPosition(created.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('ADMIN', 'HR_MANAGER'), async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM positions WHERE id = $1', [req.params.id]);

    if (!current.rows[0]) {
      throw httpError(404, 'Position not found');
    }

    const body = positionSchema.partial().parse(req.body);
    const position = positionSchema.parse({
      code: Object.hasOwn(body, 'code') ? body.code : current.rows[0].code,
      name: Object.hasOwn(body, 'name') ? body.name : current.rows[0].name,
      description: Object.hasOwn(body, 'description') ? body.description : current.rows[0].description,
      departmentId: Object.hasOwn(body, 'departmentId') ? body.departmentId : current.rows[0].department_id,
      isActive: Object.hasOwn(body, 'isActive') ? body.isActive : current.rows[0].is_active
    });

    await query(
      `UPDATE positions
       SET code = $1,
           name = $2,
           description = $3,
           department_id = $4,
           is_active = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [
        position.code.toUpperCase(),
        position.name,
        position.description ?? null,
        position.departmentId ?? null,
        position.isActive,
        req.params.id
      ]
    );
    const updated = await query(`${positionSelectSql} WHERE p.id = $1`, [req.params.id]);

    res.json({ data: mapPosition(updated.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole('ADMIN', 'HR_MANAGER'), async (req, res, next) => {
  try {
    const result = await query('DELETE FROM positions WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows[0]) {
      throw httpError(404, 'Position not found');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
