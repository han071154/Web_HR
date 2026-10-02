import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { EMPLOYMENT_TYPES } from '../constants.js';
import { pool, query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { applicationCode } from '../utils/applicationCode.js';
import { httpError } from '../utils/httpError.js';

// HR xử lý hồ sơ ứng viên nộp từ trang tuyển dụng công khai.
// Luồng trạng thái: NEW → REVIEWING → INTERVIEW → HIRED (qua /hire) hoặc REJECTED.
const router = express.Router();

const HR_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');

// HIRED không đặt trực tiếp được: phải qua POST /:id/hire để tạo hồ sơ nhân viên.
const updateSchema = z.object({
  status: z.enum(['NEW', 'REVIEWING', 'INTERVIEW', 'REJECTED']).optional(),
  note: z.string().trim().max(2000).optional().nullable(),
  interviewAt: z.string().datetime({ offset: true }).optional().nullable()
});

const hireSchema = z.object({
  employeeCode: z.string().trim().min(2).max(40),
  departmentId: z.string().uuid().optional().nullable(),
  positionId: z.string().uuid().optional().nullable(),
  position: z.string().trim().min(2).max(120).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  hireDate: dateSchema,
  baseSalary: z.coerce.number().min(0).default(0)
});

const applicationSelectSql = `
  SELECT
    a.*,
    j.code AS job_code,
    j.title AS job_title,
    j.department_id AS job_department_id,
    j.employment_type AS job_employment_type,
    e.employee_code
  FROM applications a
  JOIN job_postings j ON j.id = a.job_posting_id
  LEFT JOIN employees e ON e.id = a.employee_id
`;

function mapApplication(row) {
  return {
    id: row.id,
    applicationCode: applicationCode(row.application_no),
    jobId: row.job_posting_id,
    jobCode: row.job_code,
    jobTitle: row.job_title,
    jobDepartmentId: row.job_department_id,
    jobEmploymentType: row.job_employment_type,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    cvOriginalName: row.cv_original_name,
    coverLetter: row.cover_letter,
    status: row.status,
    note: row.note,
    interviewAt: row.interview_at,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findApplication(id) {
  const result = await query(`${applicationSelectSql} WHERE a.id = $1`, [id]);
  return result.rows[0];
}

router.get('/', async (req, res, next) => {
  try {
    const jobId = String(req.query.jobId || '').trim();
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim();
    const values = [];
    const where = [];

    if (jobId) {
      values.push(jobId);
      where.push(`a.job_posting_id = $${values.length}`);
    }

    if (status) {
      values.push(status);
      where.push(`a.status = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      // Tìm cả theo mã hồ sơ: "HS-000123" hoặc "123".
      where.push(`(a.full_name ILIKE $${values.length} OR a.email ILIKE $${values.length}
        OR a.phone ILIKE $${values.length} OR LPAD(a.application_no::text, 6, '0') ILIKE $${values.length}
        OR 'HS-' || LPAD(a.application_no::text, 6, '0') ILIKE $${values.length})`);
    }

    const result = await query(
      `${applicationSelectSql}
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY a.created_at DESC`,
      values
    );

    res.json({ data: result.rows.map(mapApplication) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const application = await findApplication(req.params.id);

    if (!application) {
      throw httpError(404, 'Application not found');
    }

    res.json({ data: mapApplication(application) });
  } catch (error) {
    next(error);
  }
});

// CV có thông tin cá nhân nên chỉ tải qua API có đăng nhập, không để public như avatar.
router.get('/:id/cv', async (req, res, next) => {
  try {
    const application = await findApplication(req.params.id);

    if (!application) {
      throw httpError(404, 'Application not found');
    }

    const filePath = path.join(config.cvUploadDir, path.basename(application.cv_path));

    if (!fs.existsSync(filePath)) {
      throw httpError(404, 'CV file not found');
    }

    res.download(filePath, application.cv_original_name || `${applicationCode(application.application_no)}.pdf`);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const current = await query('SELECT status, note, interview_at FROM applications WHERE id = $1', [req.params.id]);
    const row = current.rows[0];

    if (!row) {
      throw httpError(404, 'Application not found');
    }

    if (row.status === 'HIRED' && body.status && body.status !== 'HIRED') {
      throw httpError(409, 'Hired application status cannot be changed');
    }

    await query(
      `UPDATE applications
       SET status = $1, note = $2, interview_at = $3, updated_at = NOW()
       WHERE id = $4`,
      [
        body.status ?? row.status,
        Object.hasOwn(body, 'note') ? body.note || null : row.note,
        Object.hasOwn(body, 'interviewAt') ? body.interviewAt : row.interview_at,
        req.params.id
      ]
    );

    res.json({ data: mapApplication(await findApplication(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

// Tuyển ứng viên: tạo hồ sơ nhân viên từ thông tin hồ sơ và đánh dấu hồ sơ HIRED trong cùng một transaction.
// Phòng ban, chức danh, hình thức làm việc mặc định lấy theo tin tuyển dụng nếu HR không chọn khác.
router.post('/:id/hire', requireRole(...HR_ROLES), async (req, res, next) => {
  const client = await pool.connect();

  try {
    const body = hireSchema.parse(req.body);
    await client.query('BEGIN');

    const current = await client.query(
      `SELECT a.*, j.title AS job_title, j.department_id AS job_department_id, j.employment_type AS job_employment_type
       FROM applications a
       JOIN job_postings j ON j.id = a.job_posting_id
       WHERE a.id = $1
       FOR UPDATE OF a`,
      [req.params.id]
    );
    const application = current.rows[0];

    if (!application) {
      throw httpError(404, 'Application not found');
    }

    if (application.status === 'HIRED') {
      throw httpError(409, 'Application has already been hired');
    }

    if (application.status === 'REJECTED') {
      throw httpError(409, 'Rejected application cannot be hired');
    }

    let positionName = body.position || application.job_title;

    if (body.positionId) {
      const position = await client.query('SELECT name FROM positions WHERE id = $1', [body.positionId]);

      if (!position.rows[0]) {
        throw httpError(400, 'Selected position does not exist');
      }

      positionName = position.rows[0].name;
    }

    const employmentType = EMPLOYMENT_TYPES.includes(application.job_employment_type)
      ? application.job_employment_type
      : 'FULL_TIME';
    const employee = await client.query(
      `INSERT INTO employees (
        employee_code, full_name, email, phone, department_id, position_id, position,
        employment_type, status, hire_date, base_salary
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9, $10)
      RETURNING id`,
      [
        body.employeeCode,
        application.full_name,
        application.email.toLowerCase(),
        application.phone,
        Object.hasOwn(body, 'departmentId') ? body.departmentId : application.job_department_id,
        body.positionId || null,
        positionName,
        body.employmentType || employmentType,
        body.hireDate,
        body.baseSalary
      ]
    );

    await client.query(
      `UPDATE applications
       SET status = 'HIRED', employee_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [employee.rows[0].id, req.params.id]
    );
    await client.query('COMMIT');

    res.status(201).json({ data: mapApplication(await findApplication(req.params.id)) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    next(error);
  } finally {
    client.release();
  }
});

export default router;
