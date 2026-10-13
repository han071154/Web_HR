import ExcelJS from 'exceljs';
import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { config } from '../config.js';
import { requireRole } from '../middleware/auth.js';
import { lastDayOfMonth, localDate } from '../utils/localTime.js';
import { computeWorkHourStats, workHourExpressions } from '../utils/workHourStats.js';
import { dateSchema } from '../utils/validation.js';

const router = express.Router();

const HR_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];

const workHoursQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional()
});

// Mọi route báo cáo đều cần đăng nhập với vai trò HR trở lên.
router.use(requireRole(...HR_ROLES));

function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Số liệu cho trang Tổng quan, đã tổng hợp sẵn bằng SQL (WBS 6.4.5). Trước đây trang này tải toàn bộ
// danh sách chấm công 7 ngày và giờ công từng nhân viên để tự đếm: 5.000 nhân viên = ~12 MB mỗi lần mở,
// 50 người mở cùng lúc thì server từ chối kết nối. Response này chỉ vài trăm byte.
router.get('/dashboard', async (req, res, next) => {
  try {
    const date = dateSchema.optional().parse(req.query.date) || localDate();
    const from = shiftDate(date, -6);
    const month = date.slice(0, 7);
    const monthFrom = `${month}-01`;
    const monthTo = lastDayOfMonth(month);
    const monthHours = workHourExpressions('$3', '$4');

    const [employeeStatus, attendance, pending, monthTotals] = await Promise.all([
      query('SELECT status, COUNT(*)::int AS count FROM employees GROUP BY status'),
      query(
        `SELECT work_date, status, COUNT(*)::int AS count
         FROM attendance_records
         WHERE work_date BETWEEN $1 AND $2
         GROUP BY work_date, status
         ORDER BY work_date`,
        [from, date]
      ),
      query(
        `SELECT
           (SELECT COUNT(*)::int FROM leave_requests WHERE status = 'PENDING') AS leaves,
           (SELECT COUNT(*)::int FROM shift_change_requests WHERE status = 'PENDING') AS shift_changes`
      ),
      // Cùng cách tính giờ công / OT với utils/workHourStats.js nhưng cộng chung, không chia theo nhân viên.
      query(
        `SELECT
           COALESCE(SUM(${monthHours.workedHours}), 0) AS total_hours,
           COALESCE(SUM(${monthHours.otHours}), 0) AS ot_hours
         FROM attendance_records a
         LEFT JOIN work_schedules ws ON ws.id = a.schedule_id
         LEFT JOIN work_shifts s ON s.id = ws.shift_id
         WHERE a.work_date BETWEEN $1 AND $2
           AND a.check_in IS NOT NULL
           AND a.check_out IS NOT NULL`,
        [monthFrom, monthTo, config.defaultStandardWorkHours, config.defaultBreakMinutes]
      )
    ]);

    const statusCounts = Object.fromEntries(employeeStatus.rows.map((row) => [row.status, row.count]));

    res.json({
      data: {
        date,
        from,
        employeeStatus: {
          ACTIVE: statusCounts.ACTIVE || 0,
          ON_LEAVE: statusCounts.ON_LEAVE || 0,
          RESIGNED: statusCounts.RESIGNED || 0,
          TERMINATED: statusCounts.TERMINATED || 0
        },
        attendanceDaily: attendance.rows.map((row) => ({ workDate: row.work_date, status: row.status, count: row.count })),
        pendingLeaves: pending.rows[0].leaves,
        pendingShiftChanges: pending.rows[0].shift_changes,
        month: { from: monthFrom, to: monthTo, totalHours: Number(monthTotals.rows[0].total_hours), otHours: Number(monthTotals.rows[0].ot_hours) }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/by-department', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         d.id,
         d.name,
         COUNT(e.id) FILTER (WHERE e.status = 'ACTIVE')::int AS employee_count
       FROM departments d
       LEFT JOIN employees e ON e.department_id = d.id
       GROUP BY d.id, d.name
       ORDER BY d.name ASC`
    );

    res.json({
      data: result.rows.map((row) => ({
        departmentId: row.id,
        departmentName: row.name,
        employeeCount: row.employee_count
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/work-hours', async (req, res, next) => {
  try {
    const filters = workHoursQuerySchema.parse(req.query);
    const data = await computeWorkHourStats(filters);

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

const EXPORT_COLUMNS = [
  { header: 'Mã nhân viên', key: 'employeeCode', width: 14 },
  { header: 'Họ tên', key: 'employeeName', width: 24 },
  { header: 'Số ngày công', key: 'workDays', width: 14 },
  { header: 'Số ngày trễ', key: 'lateCount', width: 14 },
  { header: 'Số ngày vắng', key: 'absentCount', width: 14 },
  { header: 'Tổng giờ công', key: 'totalHours', width: 16 },
  { header: 'Giờ tăng ca (OT)', key: 'otHours', width: 16 }
];

// Xuất báo cáo giờ công ra Excel (HR-022/023). Chỉ xuất Excel theo quyết định của dự án —
// không có thư viện PDF trong phạm vi hiện tại, xem docs/API.md.
router.get('/export', async (req, res, next) => {
  try {
    const filters = workHoursQuerySchema.parse(req.query);
    const data = await computeWorkHourStats(filters);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo giờ công');
    sheet.columns = EXPORT_COLUMNS;
    sheet.getRow(1).font = { bold: true };

    for (const row of data) {
      sheet.addRow(row);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bao-cao-gio-cong-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

export default router;
