import express from 'express';
import { getOrdersList, getOrderTimeline } from '../services/orders.js';
import { requireProjectAccess } from '../middleware/access.js';

const router = express.Router();

router.get('/', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.query.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  try {
    const data = await getOrdersList(req.app.get('db'), projectId, { from, to, limit: Number(req.query.limit) || 50 });
    res.json(data);
  } catch (e) {
    req.log.error(e, 'orders list error');
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/timeline', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.query.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  const orderId = Number(req.params.id);
  try {
    const data = await getOrderTimeline(req.app.get('db'), projectId, orderId);
    res.json({ order_id: orderId, project_id: projectId, timeline: data });
  } catch (e) {
    req.log.error(e, 'timeline error');
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/override', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.query.project_id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  const orderId = Number(req.params.id);
  try {
    const db = req.app.get('db');
    const ov = await db.query(
      `SELECT project_id, order_id, is_urgent_override, sla_profile_override, cycle_start_override, cycle_end_override
       FROM order_overrides WHERE project_id = $1 AND order_id = $2`,
      [projectId, orderId]
    );
    res.json(ov.rows[0] || { project_id: projectId, order_id: orderId });
  } catch (e) {
    req.log.error(e, 'override get error');
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/override', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.body.project_id);
  const orderId = Number(req.params.id);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });
  if (!Number.isInteger(orderId)) return res.status(400).json({ error: 'order_id required' });
  const { is_urgent_override = null, sla_profile_override = null, cycle_start_override = null, cycle_end_override = null } = req.body;
  try {
    const db = req.app.get('db');
    await db.query(
      `INSERT INTO order_overrides (project_id, order_id, is_urgent_override, sla_profile_override, cycle_start_override, cycle_end_override)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (project_id, order_id) DO UPDATE
         SET is_urgent_override = EXCLUDED.is_urgent_override,
             sla_profile_override = EXCLUDED.sla_profile_override,
             cycle_start_override = EXCLUDED.cycle_start_override,
             cycle_end_override = EXCLUDED.cycle_end_override`,
      [projectId, orderId, is_urgent_override, sla_profile_override, cycle_start_override, cycle_end_override]
    );

    if (is_urgent_override !== null) {
      await db.query(
        `UPDATE orders_current
         SET is_urgent = $3, updated_at = NOW()
         WHERE project_id = $1 AND order_id = $2`,
        [projectId, orderId, is_urgent_override]
      );
    }

    const ov = await db.query(
      `SELECT project_id, order_id, is_urgent_override, sla_profile_override, cycle_start_override, cycle_end_override
       FROM order_overrides WHERE project_id = $1 AND order_id = $2`,
      [projectId, orderId]
    );
    res.json(ov.rows[0]);
  } catch (e) {
    req.log.error({ err: e, body: req.body }, 'override update error');
    res.status(500).json({ error: e.message });
  }
});

export default router;
