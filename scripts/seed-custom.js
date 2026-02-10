// Seed projects, status dicts, SLA, cycle rules, and urgent rules for custom-gifts (and optionally other projects)
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const PROJECT_NAME = process.argv[2] || process.env.PROJECT_NAME || 'custom-gifts';
const STATUS_FILE = process.env.STATUS_FILE || process.argv[3] || path.join(process.cwd(), 'statuses.json');

if (!fs.existsSync(STATUS_FILE)) {
  console.error(`Не знайдено файл ${STATUS_FILE}`);
  process.exit(1);
}

const statuses = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));

const pgClient = new Client({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  user: process.env.PGUSER || 'keycrm',
  password: process.env.PGPASSWORD || 'keycrm',
  database: process.env.PGDATABASE || 'keycrm'
});

const SLA_DEFAULT = [
  { group_id: 1, limit_hours: 8, is_urgent: false },
  { group_id: 2, limit_hours: 24, is_urgent: false },
  { group_id: 3, limit_hours: 24, is_urgent: false },
  { group_id: 4, limit_hours: 12, is_urgent: false }
];

async function seed() {
  await pgClient.connect();
  try {
    await pgClient.query('BEGIN');

    // Project
    const projRes = await pgClient.query(
      `INSERT INTO projects (name, base_url, api_token)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [PROJECT_NAME, process.env.KEYCRM_BASE_URL || null, process.env.KEYCRM_API_TOKEN || null]
    );

    let projectId;
    if (projRes.rows.length) {
      projectId = projRes.rows[0].id;
    } else {
      // try to find by name if not inserted
      const existing = await pgClient.query('SELECT id FROM projects WHERE name = $1', [PROJECT_NAME]);
      if (existing.rows.length === 0) {
        throw new Error('Не вдалося отримати project id');
      }
      projectId = existing.rows[0].id;
    }

    // project_settings placeholder
    await pgClient.query(
      `INSERT INTO project_settings (project_id) VALUES ($1)
       ON CONFLICT (project_id) DO NOTHING`,
      [projectId]
    );

    // status groups
    const groups = Array.from(
      new Map(statuses.map(s => [s.group_id, s.group_name || ''])).entries()
    ).map(([group_id, group_name]) => ({ group_id, group_name }));

    for (const g of groups) {
      await pgClient.query(
        `INSERT INTO status_group_dict (project_id, group_id, group_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, group_id) DO UPDATE SET group_name = EXCLUDED.group_name`,
        [projectId, g.group_id, g.group_name || `Group ${g.group_id}`]
      );
    }

    // statuses
    for (const s of statuses) {
      await pgClient.query(
        `INSERT INTO status_dict (project_id, status_id, name, alias, group_id, is_active, is_closing_order, expiration_period)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
         ON CONFLICT (project_id, status_id) DO UPDATE
           SET name = EXCLUDED.name,
               alias = EXCLUDED.alias,
               group_id = EXCLUDED.group_id,
               is_active = EXCLUDED.is_active`,
        [projectId, s.id, s.name, s.alias, s.group_id, s.is_active, false]
      );
    }

    // SLA default/urgent
    for (const sla of SLA_DEFAULT) {
      await pgClient.query(
        `INSERT INTO sla_stage_rules (project_id, group_id, is_urgent, limit_hours)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, group_id, is_urgent) DO UPDATE SET limit_hours = EXCLUDED.limit_hours`,
        [projectId, sla.group_id, sla.is_urgent, sla.limit_hours]
      );
    }

    // cycle rule default: start group 1, end group 4
    const cycleRes = await pgClient.query(
      `INSERT INTO cycle_rules (project_id, title, start_group_id, end_group_id)
       VALUES ($1, $2, 1, 4)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [projectId, 'До доставки']
    );
    let cycleId = cycleRes.rows[0]?.id;
    if (!cycleId) {
      const c = await pgClient.query(
        'SELECT id FROM cycle_rules WHERE project_id = $1 AND start_group_id = 1 AND end_group_id = 4 LIMIT 1',
        [projectId]
      );
      cycleId = c.rows[0]?.id;
    }
    if (cycleId) {
      await pgClient.query(
        `UPDATE project_settings SET default_cycle_id = $1 WHERE project_id = $2`,
        [cycleId, projectId]
      );
    }

    // urgent rule: SKU / offer for "Термінове виготовлення"
    await pgClient.query(
      `INSERT INTO urgent_rules (project_id, rule_name, match_type, match_value, is_active)
       VALUES ($1, $2, 'sku', 'Термінове виготовлення', TRUE)
       ON CONFLICT DO NOTHING`,
      [projectId, 'urgent_sku_default']
    );
    await pgClient.query(
      `INSERT INTO urgent_rules (project_id, rule_name, match_type, match_value, is_active)
       VALUES ($1, $2, 'offer_id', '16', TRUE)
       ON CONFLICT DO NOTHING`,
      [projectId, 'urgent_offer16']
    );

    await pgClient.query('COMMIT');
    console.log(`Seed OK for project "${PROJECT_NAME}" (id=${projectId})`);
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pgClient.end();
  }
}

seed();
