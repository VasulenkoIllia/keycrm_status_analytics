import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { createDb } from './db/pool.js';
import { createRedisClients } from './db/redis.js';
import webhookRouter from './routes/webhook.js';
import ordersRouter from './routes/orders.js';
import dictsRouter from './routes/dicts.js';
import settingsRouter from './routes/settings.js';
import streamRouter from './routes/stream.js';
import projectsRouter from './routes/projects.js';
import { apiAuth, loginHandler } from './middleware/auth.js';
import { startWebhookWorker } from './workers/webhookQueue.js';

dotenv.config({ path: '../.env' });

const app = express();
// Вимикаємо ETag, щоб клієнт завжди отримував свіжі дані (і не ловив 304)
app.set('etag', false);
let transport;
if (process.env.NODE_ENV === 'development') {
  try {
    transport = pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    });
  } catch (e) {
    console.warn('pino-pretty not installed; falling back to JSON logs');
  }
}

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: undefined
  },
  transport
);

app.use(pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (req.method === 'OPTIONS') return 'debug';
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req(req) {
      return { id: req.id, method: req.method, url: req.url, query: req.query, params: req.params };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
    err: pino.stdSerializers.err
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} -> ${res.statusCode} ${err ? err.message : ''}`.trim(),
  autoLogging: { ignorePaths: ['/health'] }
}));

app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
// Не кешувати API-відповіді — корисно для живої аналітики та миттєвих оновлень
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// DB pool attach
const pool = createDb();
app.set('db', pool);
const { pub: redisPub } = createRedisClients();
await redisPub.connect();
app.set('redisPub', redisPub);

const resources = {
  server: null,
  shuttingDown: false,
  webhookWorker: null
};

resources.webhookWorker = await startWebhookWorker(app, logger);

app.get('/health', async (req, res) => {
  const checks = { db: 'unknown', redis: 'unknown' };
  try {
    await pool.query('SELECT 1');
    checks.db = 'ok';
  } catch (e) {
    checks.db = `error: ${e.message}`;
  }
  try {
    await redisPub.ping();
    checks.redis = 'ok';
  } catch (e) {
    checks.redis = `error: ${e.message}`;
  }
  const status = Object.values(checks).every((v) => v === 'ok') ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({ status, checks });
});

app.use('/webhooks/keycrm', webhookRouter);
// дублюємо під /api/... щоб обійти apiAuth для webhook
app.use('/api/webhooks/keycrm', webhookRouter);
app.post('/api/login', express.json(), loginHandler);
app.use('/api', apiAuth);
app.use('/api/projects', projectsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/dicts', dictsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/stream', streamRouter);

const graceful = async (signal) => {
  if (resources.shuttingDown) return;
  resources.shuttingDown = true;
  logger.warn(`Received ${signal}, shutting down gracefully...`);
  try {
    if (resources.server) {
      await new Promise((resolve) => resources.server.close(resolve));
    }
    if (resources.webhookWorker) {
      await resources.webhookWorker.quit().catch(() => {});
    }
    await redisPub.quit().catch(() => {});
    await pool.end().catch(() => {});
  } catch (e) {
    logger.error({ err: e }, 'Error during shutdown');
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', () => graceful('SIGTERM'));
process.on('SIGINT', () => graceful('SIGINT'));
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  graceful('uncaughtException');
});

const PORT = process.env.PORT || 4000;
resources.server = app.listen(PORT, () => {
  logger.info(`Backend listening on ${PORT}`);
});
