import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { cvUpload, isPdfFile, removeCvFile } from '../middleware/cvUpload.js';
import { httpError } from '../utils/httpError.js';

// API công khai cho trang tuyển dụng: không cần đăng nhập.
// Chỉ trả tin đang mở; tin nháp coi như không tồn tại.
const router = express.Router();

const OPEN_CONDITION = "j.status = 'OPEN' AND (j.deadline IS NULL OR j.deadline >= CURRENT_DATE)";

// Mỗi IP nộp tối đa 10 hồ sơ/giờ để chống spam (lưu trong bộ nhớ, khởi động lại là xóa).
const APPLY_LIMIT = 10;
const APPLY_WINDOW_MS = 60 * 60 * 1000;
const applyHistory = new Map();

const applicationSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(160),
  phone: z
    .string()
    .transform((value) => value.replace(/[\s.-]/g, ''))
    .pipe(z.string().regex(/^0\d{9}$/)),
  coverLetter: z.string().trim().max(3000).optional().nullable(),
  consent: z.literal('true')
});

const jobSelectSql = `
  SELECT
    j.*,
    d.name AS department_name,
    (${OPEN_CONDITION}) AS is_open
  FROM job_postings j
  LEFT JOIN departments d ON d.id = j.department_id
`;

function toNumber(value) {
  return value === null ? null : Number(value);
}

function mapJobSummary(row) {
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
    deadline: row.deadline,
    isOpen: row.is_open
  };
}

function mapJobDetail(row) {
  return {
    ...mapJobSummary(row),
    experience: row.experience,
    location: row.location,
    workingTime: row.working_time,
    description: row.description,
    requirements: row.requirements,
    benefits: row.benefits
  };
}

function applicationCode(applicationNo) {
  return `HS-${String(applicationNo).padStart(6, '0')}`;
}

function checkApplyLimit(ip) {
  const now = Date.now();
  const recent = (applyHistory.get(ip) || []).filter((time) => now - time < APPLY_WINDOW_MS);
  applyHistory.set(ip, recent);

  if (recent.length >= APPLY_LIMIT) {
    throw httpError(429, 'Too many applications, please try again later');
  }
}

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const departmentId = String(req.query.departmentId || '').trim();
    const employmentType = String(req.query.employmentType || '').trim();
    const values = [];
    const where = [OPEN_CONDITION];

    if (search) {
      values.push(`%${search}%`);
      where.push(`j.title ILIKE $${values.length}`);
    }

    if (departmentId) {
      values.push(departmentId);
      where.push(`j.department_id = $${values.length}`);
    }

    if (employmentType) {
      values.push(employmentType);
      where.push(`j.employment_type = $${values.length}`);
    }

    const result = await query(
      `${jobSelectSql}
       WHERE ${where.join(' AND ')}
       ORDER BY j.deadline ASC NULLS LAST, j.created_at DESC`,
      values
    );

    res.json({ data: result.rows.map(mapJobSummary) });
  } catch (error) {
    next(error);
  }
});

// Tin đã đóng/hết hạn vẫn xem được (isOpen = false) để trang chi tiết báo "hết hạn".
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`${jobSelectSql} WHERE j.id = $1 AND j.status <> 'DRAFT'`, [req.params.id]);

    if (!result.rows[0]) {
      throw httpError(404, 'Job posting not found');
    }

    res.json({ data: mapJobDetail(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/applications', cvUpload, async (req, res, next) => {
  try {
    checkApplyLimit(req.ip);

    const body = applicationSchema.parse(req.body);

    if (!req.file) {
      throw httpError(400, 'CV file is required');
    }

    if (!(await isPdfFile(req.file.path))) {
      throw httpError(400, 'CV must be a PDF file');
    }

    const jobResult = await query(`${jobSelectSql} WHERE j.id = $1 AND j.status <> 'DRAFT'`, [req.params.id]);
    const job = jobResult.rows[0];

    if (!job) {
      throw httpError(404, 'Job posting not found');
    }

    if (!job.is_open) {
      throw httpError(409, 'Job posting is closed');
    }

    // Kiểm tra trước để báo lỗi rõ ràng; unique index trong DB vẫn chặn khi gửi trùng cùng lúc.
    const duplicate = await query(
      `SELECT 1 FROM applications
       WHERE job_posting_id = $1 AND LOWER(email) = $2 AND status <> 'REJECTED'`,
      [job.id, body.email]
    );

    if (duplicate.rows[0]) {
      throw httpError(409, 'You have already applied for this job');
    }

    // Multer đọc tên file theo latin1, đổi lại UTF-8 để giữ tên tiếng Việt.
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const result = await query(
      `INSERT INTO applications (job_posting_id, full_name, email, phone, cv_path, cv_original_name, cover_letter)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING application_no, status, created_at`,
      [job.id, body.fullName, body.email, body.phone, req.file.filename, originalName, body.coverLetter || null]
    );
    const created = result.rows[0];

    applyHistory.get(req.ip).push(Date.now());

    res.status(201).json({
      data: {
        applicationCode: applicationCode(created.application_no),
        status: created.status,
        jobId: job.id,
        jobTitle: job.title,
        fullName: body.fullName,
        email: body.email,
        createdAt: created.created_at
      }
    });
  } catch (error) {
    await removeCvFile(req.file?.filename);
    next(error);
  }
});

export default router;
