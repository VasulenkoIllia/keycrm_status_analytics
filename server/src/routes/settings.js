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
    const sla = await db.query(
      'SELECT project_id, group_id, is_urgent, limit_hours FROM sla_stage_rules WHERE project_id = $1 ORDER BY group_id, is_urgent',
      [projectId]
    );
    res.json({ project_id: projectId, rules: sla.rows });
  } catch (e) {
    req.log.error(e, 'sla get error');
    res.status(500).json({ error: e.message });
  }
});

router.put('/sla', async (req, res) => {
  const projectId = Number(req.body.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  const rules = req.body.rules || [];
  try {
    const db = req.app.get('db');
    await db.query('BEGIN');
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
    res.json({ project_id: projectId, rules: updated.rows });
  } catch (e) {
    await req.app.get('db').query('ROLLBACK');
    req.log.error(e, 'sla update error');
    res.status(500).json({ error: e.message });
  }
});

export default router;
