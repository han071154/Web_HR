import express from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { httpError } from '../utils/httpError.js';
import { getOwnEmployeeId } from '../utils/selfService.js';

const router = express.Router();

const HR_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');

// status không dùng .default(): schema này còn dùng ở PUT qua .partial(), zod áp default ngay cả
// khi field bị bỏ qua sẽ ghi đè nhầm trạng thái hiện có. Mặc định 'SCHEDULED' áp thủ công khi tạo mới.
const scheduleFieldsSchema = z.object({
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid(),
  workDate: dateSchema,
  status: z.enum(['SCHEDULED', 'CANCELLED']).optional(),
  notes: z.string().trim().max(2000).optional().nullable()
});

const bulkAssignSchema = z.object({
  assignments: z.array(
    z.object({
      employeeId: z.string().uuid(),
      shiftId: z.string().uuid(),
      workDate: dateSchema,
      notes: z.string().trim().max(2000).optional().nullable()
    })
  ).min(1).max(200)
});

const copyPreviousWeekSchema = z.object({
  weekStartDate: dateSchema,
  departmentId: z.string().uuid().optional().nullable()
});

const changeRequestSchema = z.object({
  requestedShiftId: z.string().uuid().optional().nullable(),
  reason: z.string().trim().max(2000).optional().nullable()
});

const reviewChangeRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'])
});

const scheduleSelectSql = `
  SELECT
    ws.*,
    e.employee_code,
    e.full_name AS employee_name,
    e.department_id,
    d.name AS department_name,
    s.code AS shift_code,
    s.name AS shift_name,
    s.start_time,
    s.end_time,
    s.break_minutes
  FROM work_schedules ws
  JOIN employees e ON e.id = ws.employee_id
  JOIN work_shifts s ON s.id = ws.shift_id
  LEFT JOIN departments d ON d.id = e.department_id
`;

function mapSchedule(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    shiftId: row.shift_id,
    shiftCode: row.shift_code,
    shiftName: row.shift_name,
    startTime: row.start_time,
    endTime: row.end_time,
    breakMinutes: row.break_minutes,
    workDate: row.work_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapChangeRequest(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    scheduleId: row.schedule_id,
    workDate: row.work_date,
    currentShiftId: row.current_shift_id,
    currentShiftName: row.current_shift_name,
    requestedShiftId: row.requested_shift_id,
    requestedShiftName: row.requested_shift_name,
    reason: row.reason,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Giờ công chuẩn của một ca (giờ bắt đầu/kết thúc trừ giờ nghỉ), dùng để tính giới hạn giờ/tuần.
async function getShiftHours(shiftId) {
  const result = await query(
    `SELECT EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0 - break_minutes / 60.0 AS hours
     FROM work_shifts WHERE id = $1`,
    [shiftId]
  );

  if (!result.rows[0]) {
    throw httpError(400, 'Selected shift does not exist');
  }

  return Number(result.rows[0].hours);
}

// Không trùng ca/ngày (có unique index backing ở DB, đây chỉ để báo lỗi rõ ràng hơn).
async function ensureNoScheduleConflict(employeeId, workDate, excludeId = null) {
  const result = await query(
    `SELECT id FROM work_schedules
     WHERE employee_id = $1 AND work_date = $2 AND status = 'SCHEDULED'
       AND ($3::uuid IS NULL OR id <> $3)`,
    [employeeId, workDate, excludeId]
  );

  if (result.rows[0]) {
    throw httpError(409, 'Employee already has a shift scheduled for this date');
  }
}

// Giới hạn tổng giờ làm/tuần theo luật lao động (config.maxWeeklyWorkHours, mặc định 48h).
async function ensureWeeklyHourLimit(employeeId, workDate, shiftId, excludeId = null) {
  const newShiftHours = await getShiftHours(shiftId);
  const result = await query(
    `SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0 - s.break_minutes / 60.0
      ), 0) AS hours
     FROM work_schedules ws
     JOIN work_shifts s ON s.id = ws.shift_id
     WHERE ws.employee_id = $1
       AND ws.status = 'SCHEDULED'
       AND date_trunc('week', ws.work_date::timestamp) = date_trunc('week', $2::date::timestamp)
       AND ($3::uuid IS NULL OR ws.id <> $3)`,
    [employeeId, workDate, excludeId]
  );
  const existingHours = Number(result.rows[0].hours);

  if (existingHours + newShiftHours > config.maxWeeklyWorkHours) {
    throw httpError(409, `Weekly work hour limit exceeded (max ${config.maxWeeklyWorkHours}h/week)`);
  }
}

function buildScheduleFilters(req, { forceEmployeeId } = {}) {
  const values = [];
  const where = [];
  const employeeId = forceEmployeeId || String(req.query.employeeId || '').trim();
  const departmentId = String(req.query.departmentId || '').trim();
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();

  if (employeeId) {
    values.push(employeeId);
    where.push(`ws.employee_id = $${values.length}`);
  }

  if (departmentId) {
    values.push(departmentId);
    where.push(`e.department_id = $${values.length}`);
  }

  if (from) {
    values.push(from);
    where.push(`ws.work_date >= $${values.length}`);
  }

  if (to) {
    values.push(to);
    where.push(`ws.work_date <= $${values.length}`);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

// --- Tự-phục vụ (EMPLOYEE) ---------------------------------------------------------------

router.get('/me', async (req, res, next) => {
  try {
    const employeeId = await getOwnEmployeeId(req);
    const { whereSql, values } = buildScheduleFilters(req, { forceEmployeeId: employeeId });
    const result = await query(
      `${scheduleSelectSql} ${whereSql} ORDER BY ws.work_date ASC`,
      values
    );

    res.json({ data: result.rows.map(mapSchedule) });
  } catch (error) {
    next(error);
  }
});

// Nhân viên tự đăng ký một ca còn trống cho một ngày.
router.post('/me/register', async (req, res, next) => {
  try {
    const employeeId = await getOwnEmployeeId(req);
    const body = z.object({ shiftId: z.string().uuid(), workDate: dateSchema }).parse(req.body);

    await ensureNoScheduleConflict(employeeId, body.workDate);
    await ensureWeeklyHourLimit(employeeId, body.workDate, body.shiftId);

    const result = await query(
      `INSERT INTO work_schedules (employee_id, shift_id, work_date, status)
       VALUES ($1, $2, $3, 'SCHEDULED')
       RETURNING id`,
      [employeeId, body.shiftId, body.workDate]
    );
    const created = await query(`${scheduleSelectSql} WHERE ws.id = $1`, [result.rows[0].id]);
    await logAudit({
      entityType: 'WORK_SCHEDULE',
      entityId: result.rows[0].id,
      action: 'SELF_REGISTERED',
      user: req.user
    });

    res.status(201).json({ data: mapSchedule(created.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// Nhân viên tạo yêu cầu đổi ca cho một lịch phân ca của chính mình.
router.post('/:scheduleId/change-requests', async (req, res, next) => {
  try {
    const employeeId = await getOwnEmployeeId(req);
    const body = changeRequestSchema.parse(req.body);
    const schedule = await query('SELECT * FROM work_schedules WHERE id = $1', [req.params.scheduleId]);

    if (!schedule.rows[0]) {
      throw httpError(404, 'Schedule not found');
    }

    if (schedule.rows[0].employee_id !== employeeId) {
      throw httpError(403, 'You can only request a change for your own schedule');
    }

    const result = await query(
      `INSERT INTO shift_change_requests (employee_id, schedule_id, requested_shift_id, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [employeeId, req.params.scheduleId, body.requestedShiftId || null, body.reason || null]
    );
    await logAudit({
      entityType: 'SHIFT_CHANGE_REQUEST',
      entityId: result.rows[0].id,
      action: 'CREATED',
      user: req.user
    });

    res.status(201).json({ data: { id: result.rows[0].id, status: 'PENDING' } });
  } catch (error) {
    next(error);
  }
});

// --- Yêu cầu đổi ca (HR) ------------------------------------------------------------------

const changeRequestSelectSql = `
  SELECT
    r.*,
    e.full_name AS employee_name,
    ws.work_date,
    ws.shift_id AS current_shift_id,
    cs.name AS current_shift_name,
    rs.name AS requested_shift_name
  FROM shift_change_requests r
  JOIN employees e ON e.id = r.employee_id
  JOIN work_schedules ws ON ws.id = r.schedule_id
  JOIN work_shifts cs ON cs.id = ws.shift_id
  LEFT JOIN work_shifts rs ON rs.id = r.requested_shift_id
`;

router.get('/change-requests', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const status = String(req.query.status || '').trim();
    const values = [];
    const where = [];

    if (status) {
      values.push(status);
      where.push(`r.status = $${values.length}`);
    }

    const result = await query(
      `${changeRequestSelectSql} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY r.created_at DESC`,
      values
    );

    res.json({ data: result.rows.map(mapChangeRequest) });
  } catch (error) {
    next(error);
  }
});

// HR duyệt/từ chối yêu cầu đổi ca; duyệt thì cập nhật luôn ca mới cho lịch phân ca gốc.
router.patch('/change-requests/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const body = reviewChangeRequestSchema.parse(req.body);
    const current = await query('SELECT * FROM shift_change_requests WHERE id = $1', [req.params.id]);
    const requestRow = current.rows[0];

    if (!requestRow) {
      throw httpError(404, 'Shift change request not found');
    }

    if (requestRow.status !== 'PENDING') {
      throw httpError(409, 'This request has already been reviewed');
    }

    if (body.status === 'APPROVED' && requestRow.requested_shift_id) {
      const schedule = await query('SELECT * FROM work_schedules WHERE id = $1', [requestRow.schedule_id]);
      await ensureWeeklyHourLimit(
        requestRow.employee_id,
        schedule.rows[0].work_date,
        requestRow.requested_shift_id,
        schedule.rows[0].id
      );
      await query(
        'UPDATE work_schedules SET shift_id = $1, updated_at = NOW() WHERE id = $2',
        [requestRow.requested_shift_id, requestRow.schedule_id]
      );
    }

    const updated = await query(
      `UPDATE shift_change_requests
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [body.status, req.user.sub, req.params.id]
    );
    // Không có hạ tầng thông báo (notification) nên ghi nhận quyết định vào audit log;
    // nhân viên xem kết quả qua GET /api/work-schedules/me hoặc lịch sử yêu cầu đổi ca.
    await logAudit({
      entityType: 'SHIFT_CHANGE_REQUEST',
      entityId: req.params.id,
      action: body.status,
      user: req.user
    });

    const detailed = await query(`${changeRequestSelectSql} WHERE r.id = $1`, [updated.rows[0].id]);
    res.json({ data: mapChangeRequest(detailed.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// --- Quản lý lịch phân ca (HR) ------------------------------------------------------------

router.get('/', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const { whereSql, values } = buildScheduleFilters(req);
    const result = await query(`${scheduleSelectSql} ${whereSql} ORDER BY ws.work_date ASC`, values);

    res.json({ data: result.rows.map(mapSchedule) });
  } catch (error) {
    next(error);
  }
});

// Xếp lịch hàng loạt (vd theo tuần): mỗi phần tử được kiểm tra trùng ca & giới hạn giờ/tuần riêng;
// phần tử lỗi được báo lại trong "errors" mà không chặn các phần tử hợp lệ khác.
router.post('/bulk', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const body = bulkAssignSchema.parse(req.body);
    const created = [];
    const errors = [];

    for (const assignment of body.assignments) {
      try {
        await ensureNoScheduleConflict(assignment.employeeId, assignment.workDate);
        await ensureWeeklyHourLimit(assignment.employeeId, assignment.workDate, assignment.shiftId);

        const result = await query(
          `INSERT INTO work_schedules (employee_id, shift_id, work_date, notes)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [assignment.employeeId, assignment.shiftId, assignment.workDate, assignment.notes || null]
        );
        created.push(result.rows[0].id);
      } catch (assignmentError) {
        errors.push({
          employeeId: assignment.employeeId,
          workDate: assignment.workDate,
          message: assignmentError.message || 'Could not schedule this shift'
        });
      }
    }

    if (created.length) {
      await logAudit({
        entityType: 'WORK_SCHEDULE',
        entityId: created[0],
        action: 'BULK_ASSIGNED',
        details: { count: created.length },
        user: req.user
      });
    }

    res.status(201).json({ data: { created: created.length, skipped: errors.length, errors } });
  } catch (error) {
    next(error);
  }
});

// Sao chép toàn bộ lịch SCHEDULED của tuần trước sang tuần bắt đầu từ weekStartDate.
router.post('/copy-previous-week', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const body = copyPreviousWeekSchema.parse(req.body);
    const values = [body.weekStartDate];
    let departmentFilter = '';

    if (body.departmentId) {
      values.push(body.departmentId);
      departmentFilter = 'AND e.department_id = $2';
    }

    const previousWeek = await query(
      `SELECT ws.employee_id, ws.shift_id, ws.work_date, ws.notes
       FROM work_schedules ws
       JOIN employees e ON e.id = ws.employee_id
       WHERE ws.status = 'SCHEDULED'
         AND ws.work_date >= ($1::date - INTERVAL '7 days')
         AND ws.work_date < $1::date
         ${departmentFilter}`,
      values
    );

    let created = 0;
    const errors = [];

    for (const row of previousWeek.rows) {
      const workDate = new Date(new Date(row.work_date).getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      try {
        await ensureNoScheduleConflict(row.employee_id, workDate);
        await ensureWeeklyHourLimit(row.employee_id, workDate, row.shift_id);
        await query(
          `INSERT INTO work_schedules (employee_id, shift_id, work_date, notes)
           VALUES ($1, $2, $3, $4)`,
          [row.employee_id, row.shift_id, workDate, row.notes]
        );
        created += 1;
      } catch (copyError) {
        errors.push({ employeeId: row.employee_id, workDate, message: copyError.message });
      }
    }

    res.status(201).json({ data: { created, skipped: errors.length, errors } });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const result = await query(`${scheduleSelectSql} WHERE ws.id = $1`, [req.params.id]);

    if (!result.rows[0]) {
      throw httpError(404, 'Schedule not found');
    }

    res.json({ data: mapSchedule(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const body = scheduleFieldsSchema.parse(req.body);
    const status = body.status ?? 'SCHEDULED';
    await ensureNoScheduleConflict(body.employeeId, body.workDate);
    await ensureWeeklyHourLimit(body.employeeId, body.workDate, body.shiftId);

    const result = await query(
      `INSERT INTO work_schedules (employee_id, shift_id, work_date, status, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [body.employeeId, body.shiftId, body.workDate, status, body.notes || null]
    );
    const created = await query(`${scheduleSelectSql} WHERE ws.id = $1`, [result.rows[0].id]);
    await logAudit({
      entityType: 'WORK_SCHEDULE',
      entityId: result.rows[0].id,
      action: 'CREATED',
      user: req.user
    });

    res.status(201).json({ data: mapSchedule(created.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM work_schedules WHERE id = $1', [req.params.id]);
    const row = current.rows[0];

    if (!row) {
      throw httpError(404, 'Schedule not found');
    }

    const body = scheduleFieldsSchema.partial().parse(req.body);
    const schedule = {
      employeeId: Object.hasOwn(body, 'employeeId') ? body.employeeId : row.employee_id,
      shiftId: Object.hasOwn(body, 'shiftId') ? body.shiftId : row.shift_id,
      workDate: Object.hasOwn(body, 'workDate') ? body.workDate : row.work_date,
      status: Object.hasOwn(body, 'status') ? body.status : row.status,
      notes: Object.hasOwn(body, 'notes') ? body.notes : row.notes
    };

    if (schedule.status === 'SCHEDULED') {
      await ensureNoScheduleConflict(schedule.employeeId, schedule.workDate, req.params.id);
      await ensureWeeklyHourLimit(schedule.employeeId, schedule.workDate, schedule.shiftId, req.params.id);
    }

    await query(
      `UPDATE work_schedules
       SET employee_id = $1, shift_id = $2, work_date = $3, status = $4, notes = $5, updated_at = NOW()
       WHERE id = $6`,
      [schedule.employeeId, schedule.shiftId, schedule.workDate, schedule.status, schedule.notes, req.params.id]
    );
    const updated = await query(`${scheduleSelectSql} WHERE ws.id = $1`, [req.params.id]);

    res.json({ data: mapSchedule(updated.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const result = await query('DELETE FROM work_schedules WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows[0]) {
      throw httpError(404, 'Schedule not found');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
