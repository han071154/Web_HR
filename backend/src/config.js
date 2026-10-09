import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

dotenv.config({
  path: [path.join(backendDir, '.env.local'), path.join(backendDir, '.env')]
});

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://web_hr:web_hr_password@localhost:5432/web_hr',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  avatarUploadDir: path.resolve(backendDir, process.env.AVATAR_UPLOAD_DIR || 'uploads/avatars'),
  avatarMaxSizeMb: Number(process.env.AVATAR_MAX_SIZE_MB || 5),
  // CV ứng viên có thông tin cá nhân: lưu ngoài thư mục uploads/ (thư mục đó được public).
  cvUploadDir: path.resolve(backendDir, process.env.CV_UPLOAD_DIR || 'storage/cvs'),
  cvMaxSizeMb: Number(process.env.CV_MAX_SIZE_MB || 5),
  excelMaxSizeMb: Number(process.env.EXCEL_MAX_SIZE_MB || 10),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Refresh token: hạn dùng dài hơn access token để người dùng không phải đăng nhập lại liên tục.
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  // Giới hạn tổng số giờ làm/tuần theo luật lao động khi xếp lịch ca làm việc.
  maxWeeklyWorkHours: Number(process.env.MAX_WEEKLY_WORK_HOURS || 48),
  // Check-in trễ hơn giờ bắt đầu ca (theo lịch phân ca) quá số phút này thì tính là đi trễ (LATE).
  lateThresholdMinutes: Number(process.env.LATE_THRESHOLD_MINUTES || 15),
  // Không có lịch phân ca cho ngày chấm công thì dùng số giờ chuẩn này để tính giờ OT.
  defaultStandardWorkHours: Number(process.env.DEFAULT_STANDARD_WORK_HOURS || 8)
};
