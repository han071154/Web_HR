import pg from 'pg';
import { config } from './config.js';

const { Pool, types } = pg;

// Keep PostgreSQL DATE values as calendar dates instead of converting them to UTC.
types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: config.databaseUrl
});

export async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}
