#!/usr/bin/env node
// Видаляє всі дані замовлень (event-log, агрегати, items, overrides, marketing, cycle metrics)
// Використання:
//   node scripts/clear-orders.js           — очистити ВСІ проєкти
//   node scripts/clear-orders.js 1         — очистити лише project_id=1
//
// Параметри PG читаються з env: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE.

import pg from 'pg';

const projectIdArg = process.argv[2] ? Number(process.argv[2]) : null;
if (process.argv[2] && !Number.isInteger(projectIdArg)) {
  console.error('project_id має бути числом');
  process.exit(1);
}

const client = new pg.Client({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  user: process.env.PGUSER || 'keycrm',
  password: process.env.PGPASSWORD || 'keycrm',
  database: process.env.PGDATABASE || 'keycrm'
});

const tables = [
  'order_items',
  'order_overrides',
  'order_marketing',
  'order_cycle_metrics',
  'orders_current',
  'order_status_events'
];

async function main() {
  await client.connect();
  console.log(`Очистка замовлень${projectIdArg ? ' для project_id=' + projectIdArg : ' для всіх проєктів'}...`);

  try {
    await client.query('BEGIN');
    for (const t of tables) {
      const res = await client.query(
        `DELETE FROM ${t} WHERE $1::int IS NULL OR project_id = $1`,
        [projectIdArg]
      );
      console.log(`${t}: видалено ${res.rowCount}`);
    }
    await client.query('COMMIT');
    console.log('Готово.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Помилка:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
