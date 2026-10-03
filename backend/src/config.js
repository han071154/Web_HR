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
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
};
