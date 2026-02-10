import express from 'express';
import { requireRole } from '../middleware/access.js';

const router = express.Router();

router.get('/', requireRole('admin', 'super_admin', 'user'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const role = req.user.role;
    if (role === 'super_admin') {
      const rows = await db.query(
        'SELECT id, name, base_url, webhook_url, is_active, created_at, updated_at FROM projects ORDER BY id ASC'
      );
      return res.json(rows.rows);
    }
    // admin/user: only assigned projects
    const rows = await db.query(
      `SELECT p.id, p.name, p.base_url, p.webhook_url, p.is_active, p.created_at, p.updated_at
       FROM projects p
       INNER JOIN user_projects up ON up.project_id = p.id
       WHERE up.user_id = $1
       ORDER BY p.id ASC`,
      [req.user.sub]
    );
    return res.json(rows.rows);
  } catch (e) {
    req.log.error(e, 'projects list error');
    res.status(500).json({ error: e.message });
  }
});

export default router;
