import { z } from 'zod';

// Trước đây các route chỉ kiểm tra ngày/giờ bằng regex, nên "2026-02-30", "2026-13-01" hay "25:61"
// lọt xuống PostgreSQL và trả lỗi 500. Các schema dưới đây chặn ngay từ đầu bằng lỗi 400.

// "YYYY-MM-DD" và là ngày có thật trên lịch.
export function isRealDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD')
  .refine(isRealDate, 'Date does not exist');

export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must use YYYY-MM');

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Time must use HH:mm');

// Cột tiền là NUMERIC(14, 2): lớn hơn mức này PostgreSQL báo "numeric field overflow".
export const MAX_MONEY = 999999999999.99;
export const moneySchema = z.coerce.number().min(0).max(MAX_MONEY);

// Mật khẩu: 8–72 ký tự (bcrypt chỉ dùng 72 byte đầu), có cả chữ và số. Dùng khi tự đổi mật khẩu (HR-027)
// và khi Admin cấp tài khoản / đặt lại mật khẩu (HR-007).
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');
