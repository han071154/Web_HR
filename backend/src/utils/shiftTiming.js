import { config } from '../config.js';
import { query } from '../db.js';
import { localDate, localMinutesOfDay } from './localTime.js';
import { logger } from './logger.js';

function minutesOfTime(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
}

// Số phút đi trễ so với giờ bắt đầu ca (theo múi giờ công ty). Chỉ tính khi vượt ngưỡng
// LATE_THRESHOLD_MINUTES, dưới ngưỡng coi như đúng giờ (0). Không có lịch ca thì 0.
export function lateMinutes(checkIn, shiftStartTime) {
  if (!checkIn || !shiftStartTime) {
    return 0;
  }

  const late = localMinutesOfDay(new Date(checkIn)) - minutesOfTime(shiftStartTime);
  return late > config.lateThresholdMinutes ? late : 0;
}

// Số phút về sớm so với giờ kết thúc ca, cùng cách tính ngưỡng (EARLY_LEAVE_THRESHOLD_MINUTES).
export function earlyLeaveMinutes(checkOut, shiftEndTime) {
  if (!checkOut || !shiftEndTime) {
    return 0;
  }

  const early = minutesOfTime(shiftEndTime) - localMinutesOfDay(new Date(checkOut));
  return early > config.earlyLeaveThresholdMinutes ? early : 0;
}

// Ghi Vắng (ABSENT) cho mọi ca đã xếp (SCHEDULED) của nhân viên đang làm trong ngày `date` mà không có
// bản ghi chấm công nào. Ngày nghỉ phép đã duyệt có sẵn bản ghi ON_LEAVE nên không bị ghi Vắng; duyệt
// nghỉ phép sau đó vẫn chuyển ngày Vắng thành Nghỉ phép. Chạy lại nhiều lần không tạo trùng.
export async function markAbsentForDate(date) {
  const result = await query(
    `INSERT INTO attendance_records (employee_id, schedule_id, work_date, status, note)
     SELECT ws.employee_id, ws.id, ws.work_date, 'ABSENT', 'Tự động: không chấm công theo ca đã xếp'
     FROM work_schedules ws
     JOIN employees e ON e.id = ws.employee_id
     WHERE ws.work_date = $1::date AND ws.status = 'SCHEDULED' AND e.status = 'ACTIVE'
     ON CONFLICT (employee_id, work_date) DO NOTHING`,
    [date]
  );

  return result.rowCount;
}

// Ngày hôm qua theo múi giờ công ty.
export function yesterday(now = new Date()) {
  const value = new Date(`${localDate(now)}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

// Mỗi giờ ghi Vắng cho ngày hôm qua (AUTO_MARK_ABSENT=true). Trả về hàm dừng lịch chạy.
export function startAbsenceMarker(intervalMs = 60 * 60 * 1000) {
  async function run() {
    try {
      const date = yesterday();
      const created = await markAbsentForDate(date);

      if (created) {
        logger.info(`Marked ${created} scheduled shift(s) on ${date} as ABSENT`, { date, created });
      }
    } catch (error) {
      logger.error('Could not mark absences', { error });
    }
  }

  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
