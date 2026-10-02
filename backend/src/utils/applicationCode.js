// Mã hồ sơ hiển thị cho ứng viên và HR: application_no 123 → "HS-000123".
export function applicationCode(applicationNo) {
  return `HS-${String(applicationNo).padStart(6, '0')}`;
}
