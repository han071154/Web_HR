import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import {
  avatarUpload,
  getAvatarPath,
  getAvatarUrl,
  removeAvatarFile
} from '../middleware/avatarUpload.js';
import { requireRole } from '../middleware/auth.js';
import { httpError } from '../utils/httpError.js';

const router = express.Router();

const employeeSchema = z.object({
  employeeCode: z.string().min(2).max(40),
  fullName: z.string().min(2).max(160),
  email: z.string().email().max(160),
  phone: z.string().max(40).optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  position: z.string().min(2).max(120),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED']),
  hireDate: z.string().min(10),
  baseSalary: z.coerce.number().min(0),
  address: z.string().optional().nullable()
});

const updateEmployeeSchema = employeeSchema.partial();

function mapEmployee(row, req) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    departmentId: row.department_id,
    departmentName: row.department_name,
    position: row.position,
    employmentType: row.employment_type,
    status: row.status,
    hireDate: row.hire_date,
    baseSalary: Number(row.base_salary),
    address: row.address,
    avatarUrl: getAvatarUrl(req, row.avatar_url),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const selectEmployeeSql = `
  SELECT
    e.*,
    d.name AS department_name
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
`;

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const values = [];
    const where = [];

    if (search) {
      values.push(`%${search}%`);
      where.push(`(e.full_name ILIKE $${values.length} OR e.employee_code ILIKE $${values.length} OR e.email ILIKE $${values.length})`);
    }

    if (status) {
      values.push(status);
      where.push(`e.status = $${values.length}`);
    }

    const result = await query(
      `${selectEmployeeSql}
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY e.created_at DESC`,
      values
    );

    res.json({ data: result.rows.map((row) => mapEmployee(row, req)) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`${selectEmployeeSql} WHERE e.id = $1`, [req.params.id]);
    const employee = result.rows[0];

    if (!employee) {
      throw httpError(404, 'Employee not found');
    }

    res.json({ data: mapEmployee(employee, req) });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'HR_MANAGER', 'HR_STAFF'), async (req, res, next) => {
  try {
    const body = employeeSchema.parse(req.body);
    const result = await query(
      `INSERT INTO employees (
        employee_code, full_name, email, phone, gender, date_of_birth,
        department_id, position, employment_type, status, hire_date,
        base_salary, address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        body.employeeCode,
        body.fullName,
        body.email.toLowerCase(),
        body.phone || null,
        body.gender || null,
        body.dateOfBirth || null,
        body.departmentId || null,
        body.position,
        body.employmentType,
        body.status,
        body.hireDate,
        body.baseSalary,
        body.address || null
      ]
    );
    const created = await query(`${selectEmployeeSql} WHERE e.id = $1`, [result.rows[0].id]);

    res.status(201).json({ data: mapEmployee(created.rows[0], req) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('ADMIN', 'HR_MANAGER', 'HR_STAFF'), async (req, res, next) => {
  try {
    const body = updateEmployeeSchema.parse(req.body);
    const current = await query('SELECT * FROM employees WHERE id = $1', [req.params.id]);

    if (!current.rows[0]) {
      throw httpError(404, 'Employee not found');
    }

    const merged = {
      employeeCode: Object.hasOwn(body, 'employeeCode') ? body.employeeCode : current.rows[0].employee_code,
      fullName: Object.hasOwn(body, 'fullName') ? body.fullName : current.rows[0].full_name,
      email: Object.hasOwn(body, 'email') ? body.email : current.rows[0].email,
      phone: Object.hasOwn(body, 'phone') ? body.phone : current.rows[0].phone,
      gender: Object.hasOwn(body, 'gender') ? body.gender : current.rows[0].gender,
      dateOfBirth: Object.hasOwn(body, 'dateOfBirth') ? body.dateOfBirth : current.rows[0].date_of_birth,
      departmentId: Object.hasOwn(body, 'departmentId') ? body.departmentId : current.rows[0].department_id,
      position: Object.hasOwn(body, 'position') ? body.position : current.rows[0].position,
      employmentType: Object.hasOwn(body, 'employmentType') ? body.employmentType : current.rows[0].employment_type,
      status: Object.hasOwn(body, 'status') ? body.status : current.rows[0].status,
      hireDate: Object.hasOwn(body, 'hireDate') ? body.hireDate : current.rows[0].hire_date,
      baseSalary: Object.hasOwn(body, 'baseSalary') ? body.baseSalary : current.rows[0].base_salary,
      address: Object.hasOwn(body, 'address') ? body.address : current.rows[0].address
    };

    await query(
      `UPDATE employees
       SET employee_code = $1,
           full_name = $2,
           email = $3,
           phone = $4,
           gender = $5,
           date_of_birth = $6,
           department_id = $7,
           position = $8,
           employment_type = $9,
           status = $10,
           hire_date = $11,
           base_salary = $12,
           address = $13,
           updated_at = NOW()
       WHERE id = $14`,
      [
        merged.employeeCode,
        merged.fullName,
        merged.email.toLowerCase(),
        merged.phone,
        merged.gender,
        merged.dateOfBirth,
        merged.departmentId,
        merged.position,
        merged.employmentType,
        merged.status,
        merged.hireDate,
        merged.baseSalary,
        merged.address,
        req.params.id
      ]
    );

    const updated = await query(`${selectEmployeeSql} WHERE e.id = $1`, [req.params.id]);

    res.json({ data: mapEmployee(updated.rows[0], req) });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/avatar',
  requireRole('ADMIN', 'HR_MANAGER', 'HR_STAFF'),
  async (req, _res, next) => {
    try {
      const current = await query('SELECT id, avatar_url FROM employees WHERE id = $1', [req.params.id]);

      if (!current.rows[0]) {
        throw httpError(404, 'Employee not found');
      }

      req.currentAvatarPath = current.rows[0].avatar_url;
      next();
    } catch (error) {
      next(error);
    }
  },
  avatarUpload,
  async (req, res, next) => {
    if (!req.file) {
      return next(httpError(400, 'Avatar file is required in the avatar field'));
    }

    const avatarPath = getAvatarPath(req.file.filename);

    try {
      await query(
        'UPDATE employees SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
        [avatarPath, req.params.id]
      );
      await removeAvatarFile(req.currentAvatarPath);
      const updated = await query(`${selectEmployeeSql} WHERE e.id = $1`, [req.params.id]);

      return res.json({ data: mapEmployee(updated.rows[0], req) });
    } catch (error) {
      await removeAvatarFile(avatarPath);
      return next(error);
    }
  }
);

router.delete(
  '/:id/avatar',
  requireRole('ADMIN', 'HR_MANAGER', 'HR_STAFF'),
  async (req, res, next) => {
    try {
      const current = await query('SELECT avatar_url FROM employees WHERE id = $1', [req.params.id]);

      if (!current.rows[0]) {
        throw httpError(404, 'Employee not found');
      }

      await query(
        'UPDATE employees SET avatar_url = NULL, updated_at = NOW() WHERE id = $1',
        [req.params.id]
      );
      await removeAvatarFile(current.rows[0].avatar_url);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', requireRole('ADMIN', 'HR_MANAGER'), async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM employees WHERE id = $1 RETURNING id, avatar_url',
      [req.params.id]
    );

    if (!result.rows[0]) {
      throw httpError(404, 'Employee not found');
    }

    await removeAvatarFile(result.rows[0].avatar_url);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
