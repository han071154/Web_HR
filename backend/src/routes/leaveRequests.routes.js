import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { httpError } from '../utils/httpError.js';
import { getOwnEmployeeId } from '../utils/selfService.js';

const router = express.Router();

const HR_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');

const createLeaveRequestSchema = z
  .object({
    leaveType: z.enum(['ANNUAL', 'SICK', 'UNPAID', 'OTHER']),
    startDate: dateSchema,
    endDate: dateSchema,
    reason: z.string().trim().max(2000).optional().nullable()
  })
  .refine((body) => body.endDate >= body.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after start date'
  });

const reviewLeaveRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'])
});

const leaveSelectSql = `
  SELECT
    l.*,
    e.employee_code,
    e.full_name AS employee_name,
    e.department_id,
    d.name AS department_name,
    u.full_name AS reviewed_by_name
  FROM leave_requests l
  JOIN employees e ON e.id = l.employee_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN users u ON u.id = l.approved_by
`;

function mapLeaveRequest(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    status: row.status,
    approvedBy: row.approved_by,
    approvedByName: row.reviewed_by_name,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// --- Tự-phục vụ (EMPLOYEE) ---------------------------------------------------------------

router.get('/me', async (req, res, next) => {
  try {
    const employeeId = await getOwnEmployeeId(req);
    const result = await query(
      `${leaveSelectSql} WHERE l.employee_id = $1 ORDER BY l.start_date DESC`,
      [employeeId]
    );

    res.json({ data: result.rows.map(mapLeaveRequest) });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const employeeId = await getOwnEmployeeId(req);
    const body = createLeaveRequestSchema.parse(req.body);
    const result = await query(
      `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [employeeId, body.leaveType, body.startDate, body.endDate, body.reason || null]
    );
    const created = await query(`${leaveSelectSql} WHERE l.id = $1`, [result.rows[0].id]);
    await logAudit({ entityType: 'LEAVE_REQUEST', entityId: result.rows[0].id, action: 'CREATED', user: req.user });

    res.status(201).json({ data: mapLeaveRequest(created.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// --- Quản lý đơn nghỉ phép (HR) -----------------------------------------------------------

router.get('/', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const employeeId = String(req.query.employeeId || '').trim();
    const status = String(req.query.status || '').trim();
    const values = [];
    const where = [];

    if (employeeId) {
      values.push(employeeId);
      where.push(`l.employee_id = $${values.length}`);
    }

    if (status) {
      values.push(status);
      where.push(`l.status = $${values.length}`);
    }

    const result = await query(
      `${leaveSelectSql} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY l.created_at DESC`,
      values
    );

    res.json({ data: result.rows.map(mapLeaveRequest) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const result = await query(`${leaveSelectSql} WHERE l.id = $1`, [req.params.id]);

    if (!result.rows[0]) {
      throw httpError(404, 'Leave request not found');
    }

    res.json({ data: mapLeaveRequest(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// Duyệt/từ chối đơn nghỉ phép; duyệt thì đánh dấu ON_LEAVE trên bảng chấm công cho các ngày nghỉ
// (không ghi đè ngày đã có chấm công thật, nhờ ON CONFLICT DO NOTHING).
router.patch('/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM leave_requests WHERE id = $1', [req.params.id]);
    const row = current.rows[0];

    if (!row) {
      throw httpError(404, 'Leave request not found');
    }

    if (row.status !== 'PENDING') {
      throw httpError(409, 'This leave request has already been reviewed');
    }

    const body = reviewLeaveRequestSchema.parse(req.body);

    await query(
      `UPDATE leave_requests
       SET status = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [body.status, req.user.sub, req.params.id]
    );

    if (body.status === 'APPROVED') {
      await query(
        `INSERT INTO attendance_records (employee_id, work_date, status)
         SELECT $1, d::date, 'ON_LEAVE'
         FROM generate_series($2::date, $3::date, '1 day') AS d
         ON CONFLICT (employee_id, work_date) DO NOTHING`,
        [row.employee_id, row.start_date, row.end_date]
      );
    }

    const updated = await query(`${leaveSelectSql} WHERE l.id = $1`, [req.params.id]);
    await logAudit({ entityType: 'LEAVE_REQUEST', entityId: req.params.id, action: body.status, user: req.user });

    res.json({ data: mapLeaveRequest(updated.rows[0]) });
  } catch (error) {
    next(error);
  }
});

export default router;
