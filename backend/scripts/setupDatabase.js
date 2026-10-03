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

async function seedUsers() {
  const users = [
    ['admin@webhr.local', 'admin123', 'Web HR Admin', 'ADMIN'],
    ['manager@webhr.local', 'manager123', 'HR Manager', 'HR_MANAGER'],
    ['staff@webhr.local', 'staff123', 'HR Staff', 'HR_STAFF']
  ];

  for (const [email, password, fullName, role] of users) {
    const passwordHash = await bcrypt.hash(password, 12);

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
      [email, passwordHash, fullName, role]
    );
  }
}

async function main() {
  await runSqlFile('database/schema.sql');
  await seedUsers();
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
