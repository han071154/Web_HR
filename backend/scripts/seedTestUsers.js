// Tạo tài khoản test cho bộ Postman (chạy 1 lần sau `npm run db:setup`):
//   npm run db:test-users
// Tài khoản phải khớp với biến trong tests/postman/WebHR-local.postman_environment.json.
import bcrypt from 'bcryptjs';
import { pool, query } from '../src/db.js';

const testUsers = [
  { email: 'hrstaff@webhr.local', password: 'staff123', fullName: 'Test HR Staff', role: 'HR_STAFF', isActive: true },
  { email: 'inactive@webhr.local', password: 'inactive123', fullName: 'Test Inactive User', role: 'HR_STAFF', isActive: false },
  // Vai trò nhân viên nhưng CHƯA liên kết hồ sơ (users.employee_id = NULL): dùng để test thông báo
  // "Tài khoản chưa được liên kết với hồ sơ nhân viên" ở các màn chấm công / lịch / nghỉ phép.
  { email: 'unlinked@webhr.local', password: 'unlinked123', fullName: 'Test Unlinked Employee', role: 'EMPLOYEE', isActive: true }
];

async function main() {
  for (const user of testUsers) {
    const passwordHash = await bcrypt.hash(user.password, 12);

    await query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email)
       DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()`,
      [user.email, passwordHash, user.fullName, user.role, user.isActive]
    );
  }

  console.log(`Test users ready: ${testUsers.map((user) => user.email).join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
