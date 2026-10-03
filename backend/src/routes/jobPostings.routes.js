import express from 'express';
import { z } from 'zod';
import { EMPLOYMENT_TYPES } from '../constants.js';
import { query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { httpError } from '../utils/httpError.js';

// Quản lý tin tuyển dụng phía HR (cần đăng nhập). Trang công khai đọc tin qua publicJobs.routes.js.
const router = express.Router();

const HR_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');
const optionalText = (max) => z.string().trim().max(max).optional().nullable();

const jobFieldsSchema = z.object({
  code: z.string().trim().min(2).max(40),
  title: z.string().trim().min(2).max(160),
  departmentId: z.string().uuid().optional().nullable(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  quantity: z.coerce.number().int().min(1).max(1000),
  salaryMin: z.coerce.number().min(0).optional().nullable(),
  salaryMax: z.coerce.number().min(0).optional().nullable(),
  experience: optionalText(120),
  location: optionalText(255),
  workingTime: optionalText(255),
  description: z.string().trim().min(10).max(10000),
  requirements: optionalText(10000),
  benefits: optionalText(10000),
  deadline: dateSchema.optional().nullable(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED'])
});

const jobSchema = jobFieldsSchema.superRefine((job, context) => {
  if (job.salaryMin != null && job.salaryMax != null && job.salaryMax < job.salaryMin) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['salaryMax'],
      message: 'Maximum salary must be greater than or equal to minimum salary'
    });
  }
});

const jobSelectSql = `
  SELECT
    j.*,
    d.name AS department_name,
    (j.status = 'OPEN' AND (j.deadline IS NULL OR j.deadline >= CURRENT_DATE)) AS is_open,
    COUNT(a.id)::int AS application_count,
    COUNT(a.id) FILTER (WHERE a.status = 'NEW')::int AS new_application_count
  FROM job_postings j
  LEFT JOIN departments d ON d.id = j.department_id
  LEFT JOIN applications a ON a.job_posting_id = j.id
`;

function toNumber(value) {
  return value === null ? null : Number(value);
}

function mapJob(row) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    departmentId: row.department_id,
    departmentName: row.department_name,
    employmentType: row.employment_type,
    quantity: row.quantity,
    salaryMin: toNumber(row.salary_min),
    salaryMax: toNumber(row.salary_max),
    experience: row.experience,
    location: row.location,
    workingTime: row.working_time,
    description: row.description,
    requirements: row.requirements,
    benefits: row.benefits,
    deadline: row.deadline,
    status: row.status,
    isOpen: row.is_open,
    applicationCount: row.application_count,
    newApplicationCount: row.new_application_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Đăng tin (OPEN) với hạn nộp đã qua thì trang công khai không hiện tin, nên chặn ngay khi lưu.
async function ensureDeadlineNotPassed(job) {
  if (job.status !== 'OPEN' || !job.deadline) {
    return;
  }

  const today = await query('SELECT CURRENT_DATE::text AS today');

  if (job.deadline < today.rows[0].today) {
    throw httpError(400, 'Deadline must be today or later to open a job posting');
  }
}

async function findJob(id) {
  const result = await query(`${jobSelectSql} WHERE j.id = $1 GROUP BY j.id, d.name`, [id]);
  return result.rows[0];
}

function jobValues(job) {
  return [
    job.code.toUpperCase(),
    job.title,
    job.departmentId ?? null,
    job.employmentType,
    job.quantity,
    job.salaryMin ?? null,
    job.salaryMax ?? null,
    job.experience || null,
    job.location || null,
    job.workingTime || null,
    job.description,
    job.requirements || null,
    job.benefits || null,
    job.deadline ?? null,
    job.status
  ];
}

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const departmentId = String(req.query.departmentId || '').trim();
    const values = [];
    const where = [];

    if (search) {
      values.push(`%${search}%`);
      where.push(`(j.title ILIKE $${values.length} OR j.code ILIKE $${values.length})`);
    }

    if (status) {
      values.push(status);
      where.push(`j.status = $${values.length}`);
    }

    if (departmentId) {
      values.push(departmentId);
      where.push(`j.department_id = $${values.length}`);
    }

    const result = await query(
      `${jobSelectSql}
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       GROUP BY j.id, d.name
       ORDER BY j.created_at DESC`,
      values
    );

    res.json({ data: result.rows.map(mapJob) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const job = await findJob(req.params.id);

    if (!job) {
      throw httpError(404, 'Job posting not found');
    }

    res.json({ data: mapJob(job) });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const job = jobSchema.parse(req.body);
    await ensureDeadlineNotPassed(job);
    const result = await query(
      `INSERT INTO job_postings (
        code, title, department_id, employment_type, quantity, salary_min, salary_max,
        experience, location, working_time, description, requirements, benefits, deadline, status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id`,
      [...jobValues(job), req.user.sub]
    );

    res.status(201).json({ data: mapJob(await findJob(result.rows[0].id)) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM job_postings WHERE id = $1', [req.params.id]);
    const row = current.rows[0];

    if (!row) {
      throw httpError(404, 'Job posting not found');
    }

    const body = jobFieldsSchema.partial().parse(req.body);
    const pick = (field, column) => (Object.hasOwn(body, field) ? body[field] : row[column]);
    const job = jobSchema.parse({
      code: pick('code', 'code'),
      title: pick('title', 'title'),
      departmentId: pick('departmentId', 'department_id'),
      employmentType: pick('employmentType', 'employment_type'),
      quantity: pick('quantity', 'quantity'),
      salaryMin: pick('salaryMin', 'salary_min'),
      salaryMax: pick('salaryMax', 'salary_max'),
      experience: pick('experience', 'experience'),
      location: pick('location', 'location'),
      workingTime: pick('workingTime', 'working_time'),
      description: pick('description', 'description'),
      requirements: pick('requirements', 'requirements'),
      benefits: pick('benefits', 'benefits'),
      deadline: pick('deadline', 'deadline'),
      status: pick('status', 'status')
    });

    // Chỉ kiểm tra khi mở tin hoặc đổi hạn nộp, để tin cũ đã hết hạn vẫn sửa được nội dung khác.
    if (row.status !== 'OPEN' || job.deadline !== row.deadline) {
      await ensureDeadlineNotPassed(job);
    }

    await query(
      `UPDATE job_postings
       SET code = $1,
           title = $2,
           department_id = $3,
           employment_type = $4,
           quantity = $5,
           salary_min = $6,
           salary_max = $7,
           experience = $8,
           location = $9,
           working_time = $10,
           description = $11,
           requirements = $12,
           benefits = $13,
           deadline = $14,
           status = $15,
           updated_at = NOW()
       WHERE id = $16`,
      [...jobValues(job), req.params.id]
    );

    res.json({ data: mapJob(await findJob(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

// Tin đã có hồ sơ thì không xóa (giữ lịch sử ứng tuyển); muốn ngừng nhận hồ sơ thì đóng tin.
router.delete('/:id', requireRole('ADMIN', 'HR_MANAGER'), async (req, res, next) => {
  try {
    const applications = await query('SELECT COUNT(*)::int AS count FROM applications WHERE job_posting_id = $1', [
      req.params.id
    ]);

    if (applications.rows[0].count > 0) {
      throw httpError(409, 'Job posting still has applications');
    }

    const result = await query('DELETE FROM job_postings WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows[0]) {
      throw httpError(404, 'Job posting not found');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
