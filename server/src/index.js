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
const { pub: redisPub, sub: redisSub } = createRedisClients();
await redisPub.connect();
await redisSub.connect();
app.set('redisPub', redisPub);
app.set('redisSub', redisSub);

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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  logger.info(`Backend listening on ${PORT}`);
});
