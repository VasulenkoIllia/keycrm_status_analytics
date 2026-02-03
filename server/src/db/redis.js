import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

export function createRedisClients() {
  const url =
    process.env.REDIS_URL ||
    (process.env.REDIS_HOST
      ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
      : 'redis://redis:6379');
  const pub = createClient({ url });
  return { pub };
}
