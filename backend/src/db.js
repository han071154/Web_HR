import pg from 'pg';
import { config } from './config.js';
import { logger } from './utils/logger.js';

const { Pool, types } = pg;

// Keep PostgreSQL DATE values as calendar dates instead of converting them to UTC.
types.setTypeParser(1082, (value) => value);

// Kích hoạt SSL nếu kết nối tới database trên Cloud (Supabase, Neon, Render, RDS...)
const isCloudDatabase =
  Boolean(config.databaseUrl) &&
  !config.databaseUrl.includes('localhost') &&
  !config.databaseUrl.includes('127.0.0.1') &&
  !config.databaseUrl.includes('web_hr_db') &&
  !config.databaseUrl.includes('db:5432');

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ...(isCloudDatabase ? { ssl: { rejectUnauthorized: false } } : {})
});

// Kết nối rảnh bị đóng (CSDL khởi động lại, mất mạng) làm pool phát sự kiện 'error'; không bắt thì cả tiến
// trình Node bị sập. Chỉ ghi log: request sau sẽ mở kết nối mới, /api/health trả 503 trong lúc CSDL chưa lên.
pool.on('error', (error) => {
  logger.error('Idle database client error', { error });
});

export async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}
