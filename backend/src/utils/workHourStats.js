import { config } from '../config.js';
import { query } from '../db.js';

// Biểu thức SQL giờ công / OT của một bản ghi chấm công, dùng chung cho tổng hợp tháng, báo cáo giờ
// công, xuất Excel (computeWorkHourStats) và trang Tổng quan (/reports/dashboard). Yêu cầu alias
// a = attendance_records, s = work_shifts (LEFT JOIN qua lịch phân ca của bản ghi).
//
// - Giờ công = (check_out − check_in) − giờ nghỉ giữa ca. Giờ nghỉ lấy của ca theo lịch phân ca, không có
//   lịch thì dùng DEFAULT_BREAK_MINUTES. Chỉ trừ khi thời gian có mặt quá nửa khung giờ ca (khung giờ =
//   end_time − start_time, không có lịch thì = giờ chuẩn mặc định + giờ nghỉ mặc định): làm nửa buổi
//   (vd 08:00–12:00 của ca 08:00–17:00) chưa tới giờ nghỉ nên không bị trừ.
// - Giờ chuẩn = khung giờ ca − giờ nghỉ (khớp giờ/tuần khi xếp lịch), không có lịch thì
//   DEFAULT_STANDARD_WORK_HOURS. OT = phần giờ công vượt giờ chuẩn.
// Nhờ vậy cùng làm 08:00–17:00 với ca nghỉ 60 phút thì có lịch hay không đều 8 giờ công, OT 0 (BUG-26).
export function workHourExpressions(standardParam, breakParam) {
  const standardHoursParam = `${standardParam}::numeric`;
  const breakMinutesParam = `${breakParam}::numeric`;
  const presentHours = 'EXTRACT(EPOCH FROM (a.check_out - a.check_in)) / 3600.0';
  const breakHours = `COALESCE(s.break_minutes, ${breakMinutesParam}) / 60.0`;
  const frameHours = `COALESCE(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0, ${standardHoursParam} + ${breakMinutesParam} / 60.0)`;
  const workedHours = `GREATEST(${presentHours} - CASE WHEN ${presentHours} > ${frameHours} / 2 THEN ${breakHours} ELSE 0 END, 0)`;
  const standardHours = `COALESCE(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0 - s.break_minutes / 60.0, ${standardHoursParam})`;

  return {
    workedHours,
    otHours: `GREATEST(${workedHours} - ${standardHours}, 0)`
  };
}

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

  values.push(config.defaultStandardWorkHours, config.defaultBreakMinutes);
  const { workedHours, otHours } = workHourExpressions(`$${values.length - 1}`, `$${values.length}`);

  const result = await query(
    `SELECT
       e.id AS employee_id,
       e.employee_code,
       e.full_name AS employee_name,
       COUNT(*) FILTER (WHERE a.status IN ('PRESENT', 'LATE'))::int AS work_days,
       COUNT(*) FILTER (WHERE a.status = 'LATE')::int AS late_count,
       COUNT(*) FILTER (WHERE a.status = 'ABSENT')::int AS absent_count,
       COALESCE(SUM(${workedHours})
         FILTER (WHERE a.check_in IS NOT NULL AND a.check_out IS NOT NULL), 0) AS total_hours,
       COALESCE(SUM(${otHours})
         FILTER (WHERE a.check_in IS NOT NULL AND a.check_out IS NOT NULL), 0) AS ot_hours
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
