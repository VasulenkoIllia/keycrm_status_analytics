// Run all SQL migrations in ./db in filename order (e.g., 0001_*.sql)
// Uses PG* env vars; optionally reads .env for convenience.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dbDir = path.join(root, 'db');

const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
}

const host = process.env.PGHOST || 'localhost';
const port = process.env.PGPORT || '5432';
const user = process.env.PGUSER || 'keycrm';
const password = process.env.PGPASSWORD || 'keycrm';
const database = process.env.PGDATABASE || 'keycrm';

const files = fs
  .readdirSync(dbDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (!files.length) {
  console.error('No migration files found in db/');
  process.exit(1);
}

console.log(`Running ${files.length} migrations against ${database}@${host}:${port} as ${user}`);

for (const file of files) {
  const full = path.join(dbDir, file);
  console.log(`> ${file}`);
  try {
    execSync(`PGPASSWORD="${password}" psql "${database}" -h "${host}" -p "${port}" -U "${user}" -f "${full}"`, {
      stdio: 'inherit',
      env: { ...process.env, PGPASSWORD: password }
    });
  } catch (err) {
    console.error(`Migration failed on ${file}:`, err.message);
    process.exit(1);
  }
}

console.log('Migrations completed.');
