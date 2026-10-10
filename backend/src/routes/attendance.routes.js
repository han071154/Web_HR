import express from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { httpError } from '../utils/httpError.js';
import { lastDayOfMonth, localDate, localMinutesOfDay } from '../utils/localTime.js';
import { getOwnEmployeeId } from '../utils/selfService.js';
import { computeWorkHourStats } from '../utils/workHourStats.js';

const router = express.Router();

const HR_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Month must use YYYY-MM');

const correctionSchema = z.object({
  checkIn: z.string().datetime({ offset: true }).optional().nullable(),
  checkOut: z.string().datetime({ offset: true }).optional().nullable(),
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE']).optional(),
  note: z.string().trim().max(2000).optional().nullable()
});

const attendanceSelectSql = `
  SELECT
    a.*,
    e.employee_code,
    e.full_name AS employee_name,
    e.department_id,
    d.name AS department_name,
    s.name AS shift_name
  FROM attendance_records a
  JOIN employees e ON e.id = a.employee_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN work_schedules ws ON ws.id = a.schedule_id
  LEFT JOIN work_shifts s ON s.id = ws.shift_id
`;

function mapAttendance(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    scheduleId: row.schedule_id,
    shiftName: row.shift_name,
    workDate: row.work_date,
    checkIn: row.check_in,
    checkOut: row.check_out,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Ngày theo múi giờ công ty (không dùng toISOString(): đó là giờ UTC, chấm công lúc 0h–7h sáng
// ở Việt Nam sẽ bị ghi sang ngày hôm trước).
function todayDate() {
  return localDate();
}

// Trễ hơn giờ bắt đầu ca (theo lịch phân ca hôm nay) quá config.lateThresholdMinutes thì tính LATE.
function resolveCheckInStatus(now, shiftStartTime) {
  if (!shiftStartTime) {
    return 'PRESENT';
  }

  const [hours, minutes] = shiftStartTime.split(':').map(Number);
  const thresholdMinutes = hours * 60 + minutes + config.lateThresholdMinutes;
  const nowMinutes = localMinutesOfDay(now);

  return nowMinutes > thresholdMinutes ? 'LATE' : 'PRESENT';
}

// --- Tự-phục vụ (EMPLOYEE) ---------------------------------------------------------------

router.post('/check-in', async (req, res, next) => {
  try {
    const employeeId = await getOwnEmployeeId(req);
    const workDate = todayDate();
    const existing = await query(
      'SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2',
      [employeeId, workDate]
    );

    if (existing.rows[0]?.check_in) {
      throw httpError(409, 'Already checked in today');
    }

    const schedule = await query(
      `SELECT ws.id, s.start_time
       FROM work_schedules ws
       JOIN work_shifts s ON s.id = ws.shift_id
       WHERE ws.employee_id = $1 AND ws.work_date = $2 AND ws.status = 'SCHEDULED'`,
      [employeeId, workDate]
    );
    const scheduleRow = schedule.rows[0];
    const status = resolveCheckInStatus(new Date(), scheduleRow?.start_time);

    let attendanceId;

    if (existing.rows[0]) {
      const updated = await query(
        `UPDATE attendance_records
         SET check_in = NOW(), schedule_id = $1, status = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id`,
        [scheduleRow?.id || null, status, existing.rows[0].id]
      );
      attendanceId = updated.rows[0].id;
    } else {
      const inserted = await query(
        `INSERT INTO attendance_records (employee_id, schedule_id, work_date, check_in, status)
         VALUES ($1, $2, $3, NOW(), $4)
         RETURNING id`,
        [employeeId, scheduleRow?.id || null, workDate, status]
      );
      attendanceId = inserted.rows[0].id;
    }

    const created = await query(`${attendanceSelectSql} WHERE a.id = $1`, [attendanceId]);
    await logAudit({ entityType: 'ATTENDANCE', entityId: attendanceId, action: 'CHECK_IN', user: req.user });

    res.status(existing.rows[0] ? 200 : 201).json({ data: mapAttendance(created.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post('/check-out', async (req, res, next) => {
  try {
    const employeeId = await getOwnEmployeeId(req);
    const workDate = todayDate();
    const existing = await query(
      'SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2',
      [employeeId, workDate]
    );
    const row = existing.rows[0];

    if (!row || !row.check_in) {
      throw httpError(409, 'You have not checked in today');
    }

    if (row.check_out) {
      throw httpError(409, 'Already checked out today');
    }

    await query('UPDATE attendance_records SET check_out = NOW(), updated_at = NOW() WHERE id = $1', [row.id]);
    const updated = await query(`${attendanceSelectSql} WHERE a.id = $1`, [row.id]);
    await logAudit({ entityType: 'ATTENDANCE', entityId: row.id, action: 'CHECK_OUT', user: req.user });

    res.json({ data: mapAttendance(updated.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    const employeeId = await getOwnEmployeeId(req);
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const values = [employeeId];
    const where = ['a.employee_id = $1'];

    if (from) {
      values.push(from);
      where.push(`a.work_date >= $${values.length}`);
    }

    if (to) {
      values.push(to);
      where.push(`a.work_date <= $${values.length}`);
    }

    const result = await query(
      `${attendanceSelectSql} WHERE ${where.join(' AND ')} ORDER BY a.work_date DESC`,
      values
    );

    res.json({ data: result.rows.map(mapAttendance) });
  } catch (error) {
    next(error);
  }
});

// --- Quản lý chấm công (HR) ---------------------------------------------------------------

router.get('/monthly-summary', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const month = monthSchema.parse(req.query.month);
    const employeeId = String(req.query.employeeId || '').trim() || undefined;
    const departmentId = String(req.query.departmentId || '').trim() || undefined;
    const from = `${month}-01`;
    const to = lastDayOfMonth(month);

    const data = await computeWorkHourStats({ employeeId, departmentId, from, to });

    res.json({ data, meta: { month, from, to } });
  } catch (error) {
    next(error);
  }
});

router.get('/', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const employeeId = String(req.query.employeeId || '').trim();
    const departmentId = String(req.query.departmentId || '').trim();
    const status = String(req.query.status || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const values = [];
    const where = [];

    if (employeeId) {
      values.push(employeeId);
      where.push(`a.employee_id = $${values.length}`);
    }

    if (departmentId) {
      values.push(departmentId);
      where.push(`e.department_id = $${values.length}`);
    }

    if (status) {
      values.push(status);
      where.push(`a.status = $${values.length}`);
    }

    if (from) {
      values.push(from);
      where.push(`a.work_date >= $${values.length}`);
    }

    if (to) {
      values.push(to);
      where.push(`a.work_date <= $${values.length}`);
    }

    const result = await query(
      `${attendanceSelectSql} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY a.work_date DESC`,
      values
    );

    res.json({ data: result.rows.map(mapAttendance) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const result = await query(`${attendanceSelectSql} WHERE a.id = $1`, [req.params.id]);

    if (!result.rows[0]) {
      throw httpError(404, 'Attendance record not found');
    }

    res.json({ data: mapAttendance(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// Sửa chấm công thủ công (quên check-in/check-out, điều chỉnh trạng thái).
router.put('/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM attendance_records WHERE id = $1', [req.params.id]);
    const row = current.rows[0];

    if (!row) {
      throw httpError(404, 'Attendance record not found');
    }

    const body = correctionSchema.parse(req.body);
    const merged = {
      checkIn: Object.hasOwn(body, 'checkIn') ? body.checkIn : row.check_in,
      checkOut: Object.hasOwn(body, 'checkOut') ? body.checkOut : row.check_out,
      status: Object.hasOwn(body, 'status') ? body.status : row.status,
      note: Object.hasOwn(body, 'note') ? body.note : row.note
    };

    await query(
      `UPDATE attendance_records
       SET check_in = $1, check_out = $2, status = $3, note = $4, updated_at = NOW()
       WHERE id = $5`,
      [merged.checkIn, merged.checkOut, merged.status, merged.note, req.params.id]
    );
    const updated = await query(`${attendanceSelectSql} WHERE a.id = $1`, [req.params.id]);
    await logAudit({
      entityType: 'ATTENDANCE',
      entityId: req.params.id,
      action: 'CORRECTED',
      details: { employeeId: row.employee_id, workDate: row.work_date },
      user: req.user
    });

    res.json({ data: mapAttendance(updated.rows[0]) });
  } catch (error) {
    next(error);
  }
});

export default router;
