import { config } from '../config.js';
import { query } from '../db.js';

// Dùng chung cho tổng hợp bảng công theo tháng (attendance.routes.js) và báo cáo giờ công
// theo khoảng thời gian (reports.routes.js). OT = giờ làm thực tế (check_out - check_in) trừ giờ
// chuẩn của ca (end_time - start_time của work_shifts qua lịch phân ca); không có lịch phân ca thì
// dùng config.defaultStandardWorkHours làm giờ chuẩn.
export async function computeWorkHourStats({ employeeId, departmentId, from, to }) {
  const values = [from, to];
  // Không lọc check_in/check_out ở đây: ngày vắng (ABSENT) không có giờ vào/ra nhưng vẫn phải được
  // đếm vào absent_count. Giờ công/OT chỉ cộng những ngày đã chấm đủ vào và ra (FILTER bên dưới).
  const where = ['a.work_date BETWEEN $1 AND $2'];

  if (employeeId) {
    values.push(employeeId);
    where.push(`a.employee_id = $${values.length}`);
  }

  if (departmentId) {
    values.push(departmentId);
    where.push(`e.department_id = $${values.length}`);
  }

  values.push(config.defaultStandardWorkHours);
  const standardHoursParam = `$${values.length}`;

  const result = await query(
    `SELECT
       e.id AS employee_id,
       e.employee_code,
       e.full_name AS employee_name,
       COUNT(*) FILTER (WHERE a.status IN ('PRESENT', 'LATE'))::int AS work_days,
       COUNT(*) FILTER (WHERE a.status = 'LATE')::int AS late_count,
       COUNT(*) FILTER (WHERE a.status = 'ABSENT')::int AS absent_count,
       COALESCE(SUM(EXTRACT(EPOCH FROM (a.check_out - a.check_in)) / 3600.0)
         FILTER (WHERE a.check_in IS NOT NULL AND a.check_out IS NOT NULL), 0) AS total_hours,
       COALESCE(SUM(GREATEST(
         EXTRACT(EPOCH FROM (a.check_out - a.check_in)) / 3600.0
           - COALESCE(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0, ${standardHoursParam}),
         0
       )) FILTER (WHERE a.check_in IS NOT NULL AND a.check_out IS NOT NULL), 0) AS ot_hours
     FROM attendance_records a
     JOIN employees e ON e.id = a.employee_id
     LEFT JOIN work_schedules ws ON ws.id = a.schedule_id
     LEFT JOIN work_shifts s ON s.id = ws.shift_id
     WHERE ${where.join(' AND ')}
     GROUP BY e.id, e.employee_code, e.full_name
     ORDER BY e.full_name ASC`,
    values
  );

  return result.rows.map((row) => ({
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    workDays: row.work_days,
    lateCount: row.late_count,
    absentCount: row.absent_count,
    totalHours: Number(row.total_hours),
    otHours: Number(row.ot_hours)
  }));
}
