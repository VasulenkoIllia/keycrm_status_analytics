import express from 'express';
import bcrypt from 'bcrypt';
import { requireRole } from '../middleware/access.js';

const router = express.Router();

// List users (admin/super_admin)
router.get('/', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const rows = await db.query('SELECT id, login, role, is_active, created_at, updated_at FROM users ORDER BY id ASC');
    res.json(rows.rows);
  } catch (e) {
    req.log.error(e, 'users list error');
    res.status(500).json({ error: e.message });
  }
});

// Create user
router.post('/', requireRole('admin', 'super_admin'), async (req, res) => {
  const { login, password, role = 'user', is_active = true } = req.body || {};
  if (!login || !password) return res.status(400).json({ error: 'login/password required' });
  if (!['super_admin', 'admin', 'user'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  // only super_admin may create/assign super_admin
  if (role === 'super_admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'forbidden' });
  try {
    const db = req.app.get('db');
    const hash = await bcrypt.hash(password, 10);
    const ins = await db.query(
      `INSERT INTO users (login, password_hash, role, is_active)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (login) DO NOTHING
       RETURNING id, login, role, is_active`,
      [login, hash, role, is_active]
    );
    if (!ins.rows.length) return res.status(409).json({ error: 'login exists' });
    res.status(201).json(ins.rows[0]);
  } catch (e) {
    req.log.error(e, 'user create error');
    res.status(500).json({ error: e.message });
  }
});

// Update role/status
router.put('/:id', requireRole('admin', 'super_admin'), async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'invalid id' });
  const { role, is_active } = req.body || {};
  if (role && !['super_admin', 'admin', 'user'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  if (role === 'super_admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'forbidden' });
  try {
    const db = req.app.get('db');
    const upd = await db.query(
      `UPDATE users
       SET role = COALESCE($2, role),
           is_active = COALESCE($3, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, login, role, is_active`,
      [userId, role || null, typeof is_active === 'boolean' ? is_active : null]
    );
    if (!upd.rows.length) return res.status(404).json({ error: 'user not found' });
    res.json(upd.rows[0]);
  } catch (e) {
    req.log.error(e, 'user update error');
    res.status(500).json({ error: e.message });
  }
});

// Set password
router.put('/:id/password', requireRole('admin', 'super_admin'), async (req, res) => {
  const userId = Number(req.params.id);
  const { password } = req.body || {};
  if (!Number.isInteger(userId) || !password) return res.status(400).json({ error: 'invalid' });
  try {
    const db = req.app.get('db');
    const hash = await bcrypt.hash(password, 10);
    const upd = await db.query(
      `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1 RETURNING id, login, role, is_active`,
      [userId, hash]
    );
    if (!upd.rows.length) return res.status(404).json({ error: 'user not found' });
    res.json(upd.rows[0]);
  } catch (e) {
    req.log.error(e, 'password update error');
    res.status(500).json({ error: e.message });
  }
});

// Assign projects (overwrite list)
router.put('/:id/projects', requireRole('admin', 'super_admin'), async (req, res) => {
  const userId = Number(req.params.id);
  const projects = Array.isArray(req.body.projects) ? req.body.projects.map(Number).filter(Number.isInteger) : [];
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'invalid id' });
  try {
    const db = req.app.get('db');
    await db.query('BEGIN');
    await db.query('DELETE FROM user_projects WHERE user_id = $1', [userId]);
    for (const pid of projects) {
      await db.query('INSERT INTO user_projects (user_id, project_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, pid]);
    }
    await db.query('COMMIT');
    res.json({ user_id: userId, projects });
  } catch (e) {
    await req.app.get('db').query('ROLLBACK');
    req.log.error(e, 'assign projects error');
    res.status(500).json({ error: e.message });
  }
});

// Get projects of user
router.get('/:id/projects', requireRole('admin', 'super_admin'), async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'invalid id' });
  try {
    const db = req.app.get('db');
    const rows = await db.query('SELECT project_id FROM user_projects WHERE user_id = $1', [userId]);
    res.json({ user_id: userId, projects: rows.rows.map((r) => r.project_id) });
  } catch (e) {
    req.log.error(e, 'user projects get error');
    res.status(500).json({ error: e.message });
  }
});

export default router;
