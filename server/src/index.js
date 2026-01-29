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
import { apiAuth, loginHandler } from './middleware/auth.js';

dotenv.config({ path: '../.env' });

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
app.use(pinoHttp({ logger }));

app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json({ limit: '1mb' }));

// DB pool attach
const pool = createDb();
app.set('db', pool);
const { pub: redisPub, sub: redisSub } = createRedisClients();
await redisPub.connect();
await redisSub.connect();
app.set('redisPub', redisPub);
app.set('redisSub', redisSub);

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.use('/webhooks/keycrm', webhookRouter);
app.post('/api/login', express.json(), loginHandler);
app.use('/api', apiAuth);
app.use('/api/orders', ordersRouter);
app.use('/api/dicts', dictsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/stream', streamRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  logger.info(`Backend listening on ${PORT}`);
});
