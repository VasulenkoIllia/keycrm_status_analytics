import express from 'express';
import { handleWebhook } from '../services/webhook.js';
import { webhookAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(webhookAuth);

router.post('/', async (req, res) => {
  const project = req.query.project || req.body.project || null;
  if (!project) {
    return res.status(400).json({ error: 'project is required (query ?project=ID or body.project)' });
  }
  try {
    await handleWebhook(req.app.get('db'), req.app.get('redisPub'), project, req.body);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, 'webhook error');
    res.status(500).json({ error: 'internal', detail: err.message });
  }
});

export default router;
