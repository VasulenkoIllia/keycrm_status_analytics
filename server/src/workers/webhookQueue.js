import { handleWebhook } from '../services/webhook.js';

// Запускає воркер для черги вебхуків у Redis (ключ webhook:queue)
export async function startWebhookWorker(app, logger) {
  const db = app.get('db');
  const base = app.get('redisPub');
  if (!base) {
    logger.warn('Redis is not available, webhook worker not started');
    return null;
  }
  const worker = base.duplicate();
  await worker.connect();

  const loop = async () => {
    while (true) {
      try {
        const res = await worker.brPop('webhook:queue', 5); // 5s таймаут
        if (!res) continue;
        const raw = res.element ?? res[1] ?? null;
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        await handleWebhook(db, base, parsed.project, parsed.body);
      } catch (err) {
        logger.error({ err }, 'webhook worker error');
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  };

  loop(); // fire-and-forget
  return worker;
}
