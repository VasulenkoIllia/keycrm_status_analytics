import express from 'express';
import { createClient } from 'redis';

const router = express.Router();

// Глобальний subscriber на процес для fan-out
let hub = null;
let reconnectTimer = null;

const buildRedisUrl = () =>
  process.env.REDIS_URL ||
  (process.env.REDIS_HOST
    ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
    : 'redis://redis:6379');

const resetHub = (reason) => {
  if (!hub) return;
  // Закриваємо всі підписники, щоб фронт перепідключився
  hub.listeners.forEach((set) => {
    set.forEach(({ res, hb, idleRef }) => {
      clearInterval(hb);
      if (idleRef) clearTimeout(idleRef());
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

async function connectWithRetry(makeClient, maxAttempts = 5) {
  let attempt = 0;
  let lastErr;
  while (attempt < maxAttempts) {
    try {
      const client = makeClient();
      await client.connect();
      return client;
    } catch (e) {
      lastErr = e;
      attempt += 1;
      const delay = Math.min(500 * 2 ** attempt, 5000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function getHub(app) {
  if (hub) return hub;

  // Отримуємо базовий клієнт (вже підключений у index.js) або створюємо новий
  let base = app.get('redisPub');
  if (!base) {
    const redisUrl = buildRedisUrl();
    base = await connectWithRetry(() => createClient({ url: redisUrl }), 3);
    app.set('redisPub', base);
  } else if (!base.isOpen) {
    await connectWithRetry(() => base, 3);
  }

  const sub = await connectWithRetry(() => base.duplicate(), 5);

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

  sub
    .subscribe('orders-stream', (message) => {
      try {
        const payload = JSON.parse(message);
        dispatch(payload);
      } catch (e) {
        // ignore
      }
    })
    .catch((e) => {
      hub = null;
      throw e;
    });
  sub.on('error', () => resetHub('redis_error'));
  sub.on('end', () => resetHub('redis_end'));
  sub.on('reconnecting', () => resetHub('redis_reconnect'));

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

  const keepAlive = () => res.write('event: ping\ndata: {}\n\n');
  const hb = setInterval(keepAlive, 30000);
  let idle = setTimeout(() => {
    if (!res.writableEnded) {
      res.end();
    }
  }, 120000);

  // скидаємо idle при кожному записі
  const write = res.write.bind(res);
  res.write = (...args) => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (!res.writableEnded) res.end();
    }, 120000);
    return write(...args);
  };

  const set = hubInstance.listeners.get(projectId) || new Set();
  set.add({ res, hb, idleRef: () => idle });
  hubInstance.listeners.set(projectId, set);

  const cleanup = () => {
    clearInterval(hb);
    clearTimeout(idle);
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
