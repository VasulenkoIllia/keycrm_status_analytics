import express from 'express';
import { getOrdersList, getOrderTimeline } from '../services/orders.js';

const router = express.Router();

router.get('/', async (req, res) => {
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

router.get('/:id/timeline', async (req, res) => {
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

export default router;
