import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { httpError } from '../utils/httpError.js';

const router = express.Router();

const departmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable()
});

const departmentSelectSql = `
  SELECT
    d.id,
    d.name,
    d.description,
    d.created_at,
    d.updated_at,
    COUNT(e.id)::int AS employee_count
  FROM departments d
  LEFT JOIN employees e ON e.department_id = d.id
`;

function mapDepartment(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    employeeCount: row.employee_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

router.get('/', async (_req, res, next) => {
  try {
    const result = await query(
      `${departmentSelectSql}
       GROUP BY d.id
       ORDER BY d.name ASC`
    );

    res.json({ data: result.rows.map(mapDepartment) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(
      `${departmentSelectSql}
       WHERE d.id = $1
       GROUP BY d.id`,
      [req.params.id]
    );

    if (!result.rows[0]) {
      throw httpError(404, 'Department not found');
    }

    res.json({ data: mapDepartment(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'HR_MANAGER'), async (req, res, next) => {
  try {
    const body = departmentSchema.parse(req.body);
    const result = await query(
      `INSERT INTO departments (name, description)
       VALUES ($1, $2)
       RETURNING id`,
      [body.name, body.description ?? null]
    );
    const created = await query(
      `${departmentSelectSql}
       WHERE d.id = $1
       GROUP BY d.id`,
      [result.rows[0].id]
    );

    res.status(201).json({ data: mapDepartment(created.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('ADMIN', 'HR_MANAGER'), async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM departments WHERE id = $1', [req.params.id]);

    if (!current.rows[0]) {
      throw httpError(404, 'Department not found');
    }

    const body = departmentSchema.partial().parse(req.body);
    const department = departmentSchema.parse({
      name: Object.hasOwn(body, 'name') ? body.name : current.rows[0].name,
      description: Object.hasOwn(body, 'description')
        ? body.description
        : current.rows[0].description
    });

    await query(
      `UPDATE departments
       SET name = $1, description = $2, updated_at = NOW()
       WHERE id = $3`,
      [department.name, department.description ?? null, req.params.id]
    );
    const updated = await query(
      `${departmentSelectSql}
       WHERE d.id = $1
       GROUP BY d.id`,
      [req.params.id]
    );

    res.json({ data: mapDepartment(updated.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole('ADMIN', 'HR_MANAGER'), async (req, res, next) => {
  try {
    // Không xóa phòng còn nhân viên, tránh nhân viên bị đẩy về "Chưa phân phòng" mà không biết.
    const members = await query('SELECT COUNT(*)::int AS count FROM employees WHERE department_id = $1', [
      req.params.id
    ]);

    if (members.rows[0].count > 0) {
      throw httpError(409, 'Department still has employees');
    }

    const result = await query('DELETE FROM departments WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows[0]) {
      throw httpError(404, 'Department not found');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
