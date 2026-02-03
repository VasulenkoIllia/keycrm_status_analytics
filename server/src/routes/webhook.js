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
  const redis = req.app.get('redisPub');
  if (!redis) {
    // Fallback: обробляємо синхронно, якщо Redis недоступний
    try {
      await handleWebhook(req.app.get('db'), req.app.get('redisPub'), project, req.body);
      return res.json({ ok: true, mode: 'direct' });
    } catch (err) {
      req.log.error({ err }, 'webhook error (direct)');
      return res.status(500).json({ error: 'internal', detail: err.message });
    }
  }

  try {
    await redis.lPush('webhook:queue', JSON.stringify({ project, body: req.body }));
    res.status(202).json({ queued: true });
  } catch (err) {
    req.log.error({ err }, 'webhook enqueue error');
    res.status(500).json({ error: 'internal', detail: err.message });
  }
});

export default router;
