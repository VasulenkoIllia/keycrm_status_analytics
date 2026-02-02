import express from 'express';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const router = express.Router();

// Глобальний subscriber на процес для fan-out
let hub = null;

const resetHub = (reason) => {
  if (!hub) return;
  // Закриваємо всі підписники, щоб фронт перепідключився
  hub.listeners.forEach((set) => {
    set.forEach(({ res, hb }) => {
      clearInterval(hb);
      if (!res.writableEnded) {
        res.write(`event: invalidate\ndata: {"reason":"${reason || 'redis_error'}"}\n\n`);
        res.end();
      }
    });
  });
  hub.listeners.clear();
  if (hub.sub) {
    try { hub.sub.unsubscribe('orders-stream'); } catch (e) { /* ignore */ }
    try { hub.sub.quit(); } catch (e) { /* ignore */ }
  }
  hub = null;
};

async function getHub(app) {
  if (hub) return hub;

  // Отримуємо базовий клієнт (вже підключений у index.js) або створюємо новий
  let base = app.get('redisPub');
  if (!base) {
    const redisUrl =
      process.env.REDIS_URL ||
      (process.env.REDIS_HOST
        ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
        : 'redis://redis:6379');
    base = createClient({ url: redisUrl });
    await base.connect();
    app.set('redisPub', base);
  }

  const sub = base.duplicate();
  await sub.connect();

  const listeners = new Map(); // projectId -> Set<{res, hb}>

  const dispatch = (payload) => {
    const set = listeners.get(payload.project_id);
    if (!set || set.size === 0) return;
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    const event = payload.type ? `event: ${payload.type}\n` : '';
    set.forEach(({ res }) => {
      if (res.writableEnded) return;
      res.write(event + data);
    });
  };

  sub.subscribe('orders-stream', (message) => {
    try {
      const payload = JSON.parse(message);
      dispatch(payload);
    } catch (e) {
      // ignore
    }
  }).catch((e) => {
    // якщо subscribe впав — скидати hub, щоб наступні запити пробували заново
    hub = null;
    throw e;
  });
  sub.on('error', () => resetHub('redis_error'));
  sub.on('end', () => resetHub('redis_end'));

  hub = {
    sub,
    listeners
  };
  return hub;
}

router.get('/orders', async (req, res) => {
  const projectId = Number(req.query.project_id);
  if (!Number.isInteger(projectId)) {
    return res.status(400).end('project_id is required');
  }

  let hubInstance;
  try {
    hubInstance = await getHub(req.app);
  } catch (e) {
    return res.status(503).end('redis unavailable');
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  const hb = setInterval(() => res.write('event: ping\ndata: {}\n\n'), 30000);

  const set = hubInstance.listeners.get(projectId) || new Set();
  set.add({ res, hb });
  hubInstance.listeners.set(projectId, set);

  const cleanup = () => {
    clearInterval(hb);
    const current = hubInstance.listeners.get(projectId);
    if (current) {
      const next = new Set([...current].filter((item) => item.res !== res));
      if (next.size) hubInstance.listeners.set(projectId, next);
      else hubInstance.listeners.delete(projectId);
    }
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
});

export default router;
