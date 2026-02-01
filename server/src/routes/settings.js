import express from 'express';

const router = express.Router();

router.get('/cycle', async (req, res) => {
  const projectId = Number(req.query.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  try {
    const db = req.app.get('db');
    const settings = await db.query('SELECT default_cycle_id FROM project_settings WHERE project_id = $1', [projectId]);
    const cycles = await db.query(
      'SELECT id, title, start_group_id, start_status_id, end_group_id, end_status_id FROM cycle_rules WHERE project_id = $1',
      [projectId]
    );
    res.json({ project_id: projectId, default_cycle_id: settings.rows[0]?.default_cycle_id || null, cycles: cycles.rows });
  } catch (e) {
    req.log.error(e, 'cycle settings error');
    res.status(500).json({ error: e.message });
  }
});

router.put('/cycle', async (req, res) => {
  const projectId = Number(req.body.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  const { cycle_rule_id, start_group_id, end_group_id, start_status_id = null, end_status_id = null, title = 'Цикл' } = req.body;
  try {
    const db = req.app.get('db');
    let cid = cycle_rule_id;
    if (cid) {
      await db.query(
        `UPDATE cycle_rules
         SET start_group_id=$1, end_group_id=$2, start_status_id=$3, end_status_id=$4, title=$5, updated_at=NOW()
         WHERE id=$6 AND project_id=$7`,
        [start_group_id, end_group_id, start_status_id, end_status_id, title, cid, projectId]
      );
    } else {
      const ins = await db.query(
        `INSERT INTO cycle_rules (project_id, title, start_group_id, end_group_id, start_status_id, end_status_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [projectId, title, start_group_id, end_group_id, start_status_id, end_status_id]
      );
      cid = ins.rows[0].id;
    }
    await db.query('UPDATE project_settings SET default_cycle_id=$1 WHERE project_id=$2', [cid, projectId]);
    const cycles = await db.query(
      'SELECT id, title, start_group_id, start_status_id, end_group_id, end_status_id FROM cycle_rules WHERE project_id = $1',
      [projectId]
    );
    res.json({ project_id: projectId, default_cycle_id: cid, cycles: cycles.rows });
  } catch (e) {
    req.log.error(e, 'cycle settings update error');
    res.status(500).json({ error: e.message });
  }
});

router.get('/sla', async (req, res) => {
  const projectId = Number(req.query.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  try {
    const db = req.app.get('db');
    const ps = await db.query('SELECT sla_near_threshold FROM project_settings WHERE project_id = $1', [projectId]);
    const sla = await db.query(
      'SELECT project_id, group_id, is_urgent, limit_hours FROM sla_stage_rules WHERE project_id = $1 ORDER BY group_id, is_urgent',
      [projectId]
    );
    res.json({ project_id: projectId, near_threshold: Number(ps.rows[0]?.sla_near_threshold) || 0.8, rules: sla.rows });
  } catch (e) {
    req.log.error(e, 'sla get error');
    res.status(500).json({ error: e.message });
  }
});

router.put('/sla', async (req, res) => {
  const projectId = Number(req.body.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  const rules = req.body.rules || [];
  const nearThreshold = req.body.near_threshold;
  try {
    const db = req.app.get('db');
    await db.query('BEGIN');
    if (nearThreshold !== undefined) {
      await db.query(
        `UPDATE project_settings
         SET sla_near_threshold = $2
         WHERE project_id = $1`,
        [projectId, Number(nearThreshold)]
      );
    }
    for (const r of rules) {
      await db.query(
        `INSERT INTO sla_stage_rules (project_id, group_id, is_urgent, limit_hours)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (project_id, group_id, is_urgent)
         DO UPDATE SET limit_hours = EXCLUDED.limit_hours`,
        [projectId, r.group_id, !!r.is_urgent, r.limit_hours]
      );
    }
    await db.query('COMMIT');
    const updated = await db.query(
      'SELECT project_id, group_id, is_urgent, limit_hours FROM sla_stage_rules WHERE project_id = $1 ORDER BY group_id, is_urgent',
      [projectId]
    );
    const ps = await db.query('SELECT sla_near_threshold FROM project_settings WHERE project_id = $1', [projectId]);
    res.json({ project_id: projectId, near_threshold: Number(ps.rows[0]?.sla_near_threshold) || 0.8, rules: updated.rows });
  } catch (e) {
    await req.app.get('db').query('ROLLBACK');
    req.log.error(e, 'sla update error');
    res.status(500).json({ error: e.message });
  }
});

router.get('/project', async (req, res) => {
  const projectId = Number(req.query.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  try {
    const db = req.app.get('db');
    const proj = await db.query(
      'SELECT id, name, base_url, api_token, webhook_url, webhook_token, is_active, created_at, updated_at FROM projects WHERE id = $1',
      [projectId]
    );
    if (!proj.rows.length) return res.status(404).json({ error: 'project not found' });
    let project = proj.rows[0];

    // Автогенерація webhook_url, якщо порожній
    if (!project.webhook_url) {
      const base =
        process.env.PUBLIC_BASE_URL ||
        (req.headers.origin ? req.headers.origin : req.protocol + '://' + req.get('host'));
      const normalizedBase = (base || '').replace(/\/$/, '');
      const autoUrl = `${normalizedBase}/api/webhooks/keycrm?project=${projectId}`;
      const upd = await db.query(
        `UPDATE projects SET webhook_url = $2, updated_at = NOW() WHERE id = $1 RETURNING webhook_url`,
        [projectId, autoUrl]
      );
      project = { ...project, webhook_url: upd.rows[0].webhook_url };
    }

    res.json(project);
  } catch (e) {
    req.log.error(e, 'project settings get error');
    res.status(500).json({ error: e.message });
  }
});

router.put('/project', async (req, res) => {
  const projectId = Number(req.body.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  const { name = null, base_url = null, api_token = null, webhook_url = null, webhook_token = null } = req.body;
  const is_active = typeof req.body.is_active === 'boolean' ? req.body.is_active : null;
  try {
    const db = req.app.get('db');
    const upd = await db.query(
      `UPDATE projects
       SET name = COALESCE($2, name),
           base_url = COALESCE($3, base_url),
           api_token = COALESCE($4, api_token),
           webhook_url = COALESCE($5, webhook_url),
           webhook_token = COALESCE($6, webhook_token),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, base_url, api_token, webhook_url, webhook_token, is_active, created_at, updated_at`,
      [projectId, name, base_url || null, api_token || null, webhook_url || null, webhook_token || null, is_active]
    );
    if (!upd.rows.length) return res.status(404).json({ error: 'project not found' });
    res.json(upd.rows[0]);
  } catch (e) {
    req.log.error({ err: e, body: req.body }, 'project settings update error');
    res.status(500).json({ error: e.message });
  }
});

router.get('/urgent-rules', async (req, res) => {
  const projectId = Number(req.query.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  try {
    const db = req.app.get('db');
    const rows = await db.query(
      `SELECT id, rule_name, match_type, match_value, is_active, created_at, updated_at
       FROM urgent_rules
       WHERE project_id = $1
       ORDER BY id ASC`,
      [projectId]
    );
    res.json({ project_id: projectId, rules: rows.rows });
  } catch (e) {
    req.log.error(e, 'urgent rules get error');
    res.status(500).json({ error: e.message });
  }
});

import { recomputeUrgentForProject } from '../services/urgentRules.js';

router.put('/urgent-rules', async (req, res) => {
  const projectId = Number(req.body.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  const rules = req.body.rules || [];
  try {
    const db = req.app.get('db');
    await db.query('BEGIN');
    await db.query('DELETE FROM urgent_rules WHERE project_id = $1', [projectId]);
    for (const r of rules) {
      if (!r.match_type || !r.match_value) throw new Error('invalid rule');
      const matchType = r.match_type;
      if (!['sku', 'offer_id', 'product_id'].includes(matchType)) throw new Error('invalid match_type');
      await db.query(
        `INSERT INTO urgent_rules (project_id, rule_name, match_type, match_value, is_active)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [projectId, r.rule_name || 'rule', matchType, String(r.match_value), r.is_active !== false]
      );
    }
    await db.query('COMMIT');
    const updated = await db.query(
      `SELECT id, rule_name, match_type, match_value, is_active, created_at, updated_at
       FROM urgent_rules WHERE project_id = $1 ORDER BY id ASC`,
      [projectId]
    );
    // Recalculate existing orders to відобразити нові назви/правила
    await recomputeUrgentForProject(db, projectId);
    res.json({ project_id: projectId, rules: updated.rows });
  } catch (e) {
    await req.app.get('db').query('ROLLBACK');
    req.log.error({ err: e, body: req.body }, 'urgent rules update error');
    res.status(400).json({ error: e.message });
  }
});

router.get('/working-hours', async (req, res) => {
  const projectId = Number(req.query.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  try {
    const db = req.app.get('db');
    const rows = await db.query(
      `SELECT group_id, weekday, ranges
       FROM working_hours
       WHERE project_id = $1
       ORDER BY group_id, weekday`,
      [projectId]
    );
    res.json({ project_id: projectId, rules: rows.rows });
  } catch (e) {
    req.log.error(e, 'working hours get error');
    res.status(500).json({ error: e.message });
  }
});

function isValidTimeStr(str) {
  if (typeof str !== 'string') return false;
  // allow 0-23 with optional leading zero (e.g., "9:00", "09:00", "23:59")
  const m = str.trim().match(/^([01]?\d|2[0-3]):[0-5]\d$/);
  return !!m;
}

function isValidRanges(ranges) {
  if (!Array.isArray(ranges)) return false;
  if (ranges.length === 0) return true; // day off
  for (const r of ranges) {
    if (!r || !isValidTimeStr(r.start) || !isValidTimeStr(r.end)) return false;
    if (r.start >= r.end) return false;
  }
  return true;
}

function normalizeRangesInput(raw) {
  // Accept array of objects, array of JSON strings, or JSON string
  let ranges = raw;
  if (typeof raw === 'string') {
    try {
      ranges = JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  if (!Array.isArray(ranges)) return null;
  const normalized = [];
  for (const item of ranges) {
    let obj = item;
    if (typeof item === 'string') {
      try {
        obj = JSON.parse(item);
      } catch (e) {
        return null;
      }
    }
    if (!obj || typeof obj.start === 'undefined' || typeof obj.end === 'undefined') return null;
    normalized.push({ start: String(obj.start), end: String(obj.end) });
  }
  return normalized;
}

router.put('/working-hours', async (req, res) => {
  const projectId = Number(req.body.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  const rules = req.body.rules || [];
  try {
    const db = req.app.get('db');
    await db.query('BEGIN');
    await db.query('DELETE FROM working_hours WHERE project_id = $1', [projectId]);
    for (const r of rules) {
      const gid = Number(r.group_id);
      const weekday = Number(r.weekday);
      if (!Number.isInteger(gid) || gid <= 0) throw new Error('invalid group_id');
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error('invalid weekday');
      const ranges = normalizeRangesInput(r.ranges);
      if (!isValidRanges(ranges)) {
        throw new Error(`invalid ranges for group ${gid}, weekday ${weekday}`);
      }
      await db.query(
        `INSERT INTO working_hours (project_id, group_id, weekday, ranges, updated_at)
         VALUES ($1,$2,$3,$4::jsonb,NOW())
         ON CONFLICT (project_id, group_id, weekday)
         DO UPDATE SET ranges = EXCLUDED.ranges, updated_at = NOW()`,
        [projectId, gid, weekday, JSON.stringify(ranges)]
      );
    }
    await db.query('COMMIT');
    const updated = await db.query(
      `SELECT group_id, weekday, ranges
       FROM working_hours
       WHERE project_id = $1
       ORDER BY group_id, weekday`,
      [projectId]
    );
    res.json({ project_id: projectId, rules: updated.rows });
  } catch (e) {
    await req.app.get('db').query('ROLLBACK');
    req.log.error({ err: e, body: req.body }, 'working hours update error');
    res.status(400).json({ error: e.message, detail: e.detail || null });
  }
});

export default router;
