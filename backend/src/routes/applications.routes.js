import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { EMPLOYMENT_TYPES } from '../constants.js';
import { pool, query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { removeCvFile } from '../middleware/cvUpload.js';
import { applicationCode } from '../utils/applicationCode.js';
import { listAudit, logAudit } from '../utils/audit.js';
import { httpError } from '../utils/httpError.js';

// HR xử lý hồ sơ ứng viên nộp từ trang tuyển dụng công khai (Figma M-08c, M-08d, M-08e).
// Luồng trạng thái: NEW (Mới nộp) → REVIEWING (Đang xét) → INTERVIEW (Phỏng vấn)
// → HIRED (Đậu) hoặc REJECTED (Trượt). Hồ sơ Đậu mới được chuyển thành nhân sự qua /convert.
const router = express.Router();

const HR_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const STATUSES = ['NEW', 'REVIEWING', 'INTERVIEW', 'HIRED', 'REJECTED'];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');

const updateSchema = z.object({
  status: z.enum(STATUSES).optional(),
  note: z.string().trim().max(2000).optional().nullable(),
  interviewAt: z.string().datetime({ offset: true }).optional().nullable()
});

// Chuyển thành nhân sự: tạo hồ sơ nhân viên và hợp đồng đầu tiên (thường là thử việc).
const convertSchema = z
  .object({
    employeeCode: z.string().trim().min(2).max(40),
    departmentId: z.string().uuid().optional().nullable(),
    positionId: z.string().uuid().optional().nullable(),
    position: z.string().trim().min(2).max(120).optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    hireDate: dateSchema,
    baseSalary: z.coerce.number().min(0),
    contractType: z.enum(['PROBATION', 'FIXED_TERM', 'INDEFINITE', 'SEASONAL']),
    contractEndDate: dateSchema.optional().nullable()
  })
  .superRefine((body, context) => {
    if (body.contractType === 'INDEFINITE' && body.contractEndDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contractEndDate'],
        message: 'Indefinite contracts must not have an end date'
      });
    }

    if (body.contractType !== 'INDEFINITE' && (!body.contractEndDate || body.contractEndDate < body.hireDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contractEndDate'],
        message: 'Contract end date is required and must be on or after the hire date'
      });
    }
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
    viewedAt: row.viewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findApplication(id) {
  const result = await query(`${applicationSelectSql} WHERE a.id = $1`, [id]);
  return result.rows[0];
}

function cvFilePath(application) {
  return path.join(config.cvUploadDir, path.basename(application.cv_path));
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

// Chi tiết hồ sơ kèm lịch sử xử lý. HR mở xem lần đầu thì đánh dấu đã xem (bỏ chấm xanh ở danh sách).
router.get('/:id', async (req, res, next) => {
  try {
    const application = await findApplication(req.params.id);

    if (!application) {
      throw httpError(404, 'Application not found');
    }

    if (!application.viewed_at) {
      const viewed = await query('UPDATE applications SET viewed_at = NOW() WHERE id = $1 RETURNING viewed_at', [
        req.params.id
      ]);
      application.viewed_at = viewed.rows[0].viewed_at;
    }

    res.json({
      data: {
        ...mapApplication(application),
        cvSize: fs.existsSync(cvFilePath(application)) ? fs.statSync(cvFilePath(application)).size : null,
        history: await listAudit('APPLICATION', req.params.id)
      }
    });
  } catch (error) {
    next(error);
  }
});

// CV có thông tin cá nhân nên chỉ tải qua API có đăng nhập, không để public như avatar.
// ?inline=1 để trình duyệt hiển thị ngay (xem trước) thay vì tải xuống.
router.get('/:id/cv', async (req, res, next) => {
  try {
    const application = await findApplication(req.params.id);

    if (!application) {
      throw httpError(404, 'Application not found');
    }

    const filePath = cvFilePath(application);

    if (!fs.existsSync(filePath)) {
      throw httpError(404, 'CV file not found');
    }

    const fileName = application.cv_original_name || `${applicationCode(application.application_no)}.pdf`;

    if (req.query.inline) {
      res.type('application/pdf');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.sendFile(filePath);
      return;
    }

    res.download(filePath, fileName);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const current = await query('SELECT status, note, interview_at, employee_id FROM applications WHERE id = $1', [
      req.params.id
    ]);
    const row = current.rows[0];

    if (!row) {
      throw httpError(404, 'Application not found');
    }

    const status = body.status ?? row.status;
    const note = Object.hasOwn(body, 'note') ? body.note || null : row.note;
    const interviewAt = Object.hasOwn(body, 'interviewAt') ? body.interviewAt : row.interview_at;

    // Đã chuyển thành nhân viên thì hồ sơ khóa trạng thái.
    if (row.employee_id && status !== row.status) {
      throw httpError(409, 'Converted application status cannot be changed');
    }

    if (status === 'INTERVIEW' && !interviewAt) {
      throw httpError(400, 'Interview time is required for interview status');
    }

    await query(
      `UPDATE applications
       SET status = $1, note = $2, interview_at = $3, updated_at = NOW()
       WHERE id = $4`,
      [status, note, interviewAt, req.params.id]
    );

    if (status !== row.status) {
      await logAudit({
        entityType: 'APPLICATION',
        entityId: req.params.id,
        action: 'STATUS_CHANGED',
        details: { from: row.status, to: status },
        user: req.user
      });
    }

    if (new Date(interviewAt || 0).getTime() !== new Date(row.interview_at || 0).getTime() && interviewAt) {
      await logAudit({
        entityType: 'APPLICATION',
        entityId: req.params.id,
        action: 'INTERVIEW_SCHEDULED',
        details: { interviewAt },
        user: req.user
      });
    }

    if ((note || '') !== (row.note || '')) {
      await logAudit({ entityType: 'APPLICATION', entityId: req.params.id, action: 'NOTE_UPDATED', user: req.user });
    }

    res.json({ data: mapApplication(await findApplication(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

// Chuyển ứng viên Đậu thành nhân sự (M-08e): tạo hồ sơ nhân viên và hợp đồng đầu tiên trong cùng một
// transaction. Phòng ban, chức danh, hình thức làm việc mặc định lấy theo tin tuyển dụng.
router.post('/:id/convert', requireRole(...HR_ROLES), async (req, res, next) => {
  const client = await pool.connect();

  try {
    const body = convertSchema.parse(req.body);
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

    if (application.employee_id) {
      throw httpError(409, 'Application has already been converted');
    }

    if (application.status !== 'HIRED') {
      throw httpError(409, 'Only passed applications can be converted');
    }

    let positionName = body.position || application.job_title;

    if (body.positionId) {
      const position = await client.query('SELECT name FROM positions WHERE id = $1', [body.positionId]);

      if (!position.rows[0]) {
        throw httpError(400, 'Selected position does not exist');
      }

      positionName = position.rows[0].name;
    }

    const jobEmploymentType = EMPLOYMENT_TYPES.includes(application.job_employment_type)
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
        body.employmentType || jobEmploymentType,
        body.hireDate,
        body.baseSalary
      ]
    );
    const employeeId = employee.rows[0].id;
    const contractNumber = `HDLD-${body.employeeCode}-${body.hireDate.slice(0, 4)}`;

    await client.query(
      `INSERT INTO employment_contracts (
        contract_number, employee_id, contract_type, start_date, end_date, salary, status, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7)`,
      [
        contractNumber,
        employeeId,
        body.contractType,
        body.hireDate,
        body.contractEndDate || null,
        body.baseSalary,
        `Tạo khi tuyển từ hồ sơ ${applicationCode(application.application_no)}`
      ]
    );
    await client.query('UPDATE applications SET employee_id = $1, updated_at = NOW() WHERE id = $2', [
      employeeId,
      req.params.id
    ]);

    const code = applicationCode(application.application_no);
    await logAudit(
      { entityType: 'APPLICATION', entityId: req.params.id, action: 'CONVERTED', details: { employeeCode: body.employeeCode }, user: req.user },
      client
    );
    await logAudit(
      { entityType: 'EMPLOYEE', entityId: employeeId, action: 'CREATED', details: { applicationCode: code }, user: req.user },
      client
    );
    await logAudit(
      {
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        action: 'CONTRACT_ADDED',
        details: { contractNumber, contractType: body.contractType },
        user: req.user
      },
      client
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

// BUG-05: xoá hồ sơ ứng viên. Hồ sơ đã chuyển thành nhân sự thì giữ lại (là nguồn gốc hợp đồng đầu tiên).
// Cùng quyền với các thao tác xoá khác trong hệ thống (ADMIN, HR_MANAGER).
router.delete('/:id', requireRole('ADMIN', 'HR_MANAGER'), async (req, res, next) => {
  try {
    const current = await query('SELECT cv_path, employee_id FROM applications WHERE id = $1', [req.params.id]);
    const row = current.rows[0];

    if (!row) {
      throw httpError(404, 'Application not found');
    }

    if (row.employee_id) {
      throw httpError(409, 'Cannot delete an application that has already been converted to an employee');
    }

    await query('DELETE FROM applications WHERE id = $1', [req.params.id]);
    await query("DELETE FROM audit_logs WHERE entity_type = 'APPLICATION' AND entity_id = $1", [req.params.id]);
    await removeCvFile(row.cv_path);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
