import { query } from '../db.js';
import { logger } from './logger.js';

// "2026-10-14" → "14/10/2026" cho nội dung thông báo.
export function formatVnDate(date) {
  const [year, month, day] = String(date).slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

// Gửi thông báo trong ứng dụng tới tài khoản liên kết với hồ sơ nhân viên (HR-034). Nhân viên chưa có
// tài khoản thì không có ai để nhận, bỏ qua. Lỗi ghi thông báo không được làm hỏng thao tác duyệt chính.
export async function notifyEmployee({ employeeId, type, title, message, entityType = null, entityId = null }) {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
       SELECT id, $2, $3, $4, $5, $6 FROM users WHERE employee_id = $1`,
      [employeeId, type, title, message, entityType, entityId]
    );
  } catch (error) {
    logger.error('Could not create notification', { employeeId, type, error });
  }
}
