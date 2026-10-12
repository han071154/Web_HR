import { query } from '../db.js';
import { httpError } from './httpError.js';

// Dùng cho các route tự-phục vụ (EMPLOYEE): JWT chỉ chứa users.id, nên cần tra employee_id
// mỗi lần gọi để luôn lấy liên kết mới nhất (users.employee_id có thể đổi mà không cần đăng nhập lại).
export async function getOwnEmployeeId(req) {
  const result = await query('SELECT employee_id FROM users WHERE id = $1', [req.user.sub]);
  const employeeId = result.rows[0]?.employee_id;

  if (!employeeId) {
    throw httpError(409, 'This account is not linked to an employee profile');
  }

  return employeeId;
}
