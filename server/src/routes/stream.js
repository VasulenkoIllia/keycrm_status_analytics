import express from 'express';

const router = express.Router();

router.get('/orders', async (req, res) => {
  const projectId = Number(req.query.project_id);
  if (!Number.isInteger(projectId)) {
    return res.status(400).end('project_id is required');
  }

  const redisSub = req.app.get('redisSub');

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
    } catch (e) {
      // ignore
    }
  });
});

export default router;
