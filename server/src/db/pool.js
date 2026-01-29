import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

export function createDb() {
  const pool = new pg.Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    user: process.env.PGUSER || 'keycrm',
    password: process.env.PGPASSWORD || 'keycrm',
    database: process.env.PGDATABASE || 'keycrm',
    max: 10
  });
  return pool;
}
