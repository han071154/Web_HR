import pg from 'pg';
import { config } from './config.js';

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

export async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}
