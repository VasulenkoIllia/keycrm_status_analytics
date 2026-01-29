import express from 'express';

const router = express.Router();

router.get('/statuses', async (req, res) => {
  const projectId = Number(req.query.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  try {
    const db = req.app.get('db');
    const groups = await db.query('SELECT group_id, group_name FROM status_group_dict WHERE project_id = $1 ORDER BY group_id', [projectId]);
    const statuses = await db.query(
      'SELECT status_id, name, alias, group_id, is_active, is_closing_order, expiration_period FROM status_dict WHERE project_id = $1 ORDER BY status_id',
      [projectId]
    );
    res.json({ project_id: projectId, groups: groups.rows, statuses: statuses.rows });
  } catch (e) {
    req.log.error(e, 'dicts error');
    res.status(500).json({ error: e.message });
  }
});

export default router;
