import express from 'express';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const router = express.Router();

router.get('/orders', async (req, res) => {
  const projectId = Number(req.query.project_id);
  if (!Number.isInteger(projectId)) {
    return res.status(400).end('project_id is required');
  }
  // Per-connection subscriber to avoid conflicts between SSE clients
  const redisUrl =
    process.env.REDIS_URL ||
    (process.env.REDIS_HOST
      ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
      : 'redis://redis:6379');
  const redisSub = createClient({ url: redisUrl });
  await redisSub.connect();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  const heartbeat = setInterval(() => res.write('event: ping\ndata: {}\n\n'), 30000);

  const handler = (message) => {
    try {
      const payload = JSON.parse(message);
      if (payload.project_id !== projectId) return;
      if (process.env.LOG_LEVEL === 'debug') {
        // eslint-disable-next-line no-console
        console.log('SSE push', payload);
      }
      res.write(`event: ${payload.type || 'order_updated'}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
      // ignore malformed
    }
  };

  await redisSub.subscribe('orders-stream', handler);

  req.on('close', async () => {
    clearInterval(heartbeat);
    try {
      await redisSub.unsubscribe('orders-stream', handler);
      await redisSub.quit();
    } catch (e) {
      // ignore
    }
  });
});

export default router;
