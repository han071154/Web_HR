import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from '../src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

async function runSqlFile(relativePath) {
  const sql = await fs.readFile(path.join(rootDir, relativePath), 'utf8');
  await query(sql);
}

async function seedAdmin() {
  const passwordHash = await bcrypt.hash('admin123', 12);

  await query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email)
     DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       role = EXCLUDED.role,
       is_active = TRUE,
       updated_at = NOW()`,
    ['admin@webhr.local', passwordHash, 'Web HR Admin', 'ADMIN']
  );
}

async function main() {
  await runSqlFile('database/schema.sql');
  await seedAdmin();
  await runSqlFile('database/seed.sql');
  console.log('Database schema and seed data are ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
