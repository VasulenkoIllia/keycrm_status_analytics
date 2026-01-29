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

export default router;
