import express from 'express';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const db = req.app.get('db');
    const rows = await db.query(
      'SELECT id, name, base_url, webhook_url, is_active, created_at, updated_at FROM projects ORDER BY id ASC'
    );
    res.json(rows.rows);
  } catch (e) {
    req.log.error(e, 'projects list error');
    res.status(500).json({ error: e.message });
  }
});

export default router;
