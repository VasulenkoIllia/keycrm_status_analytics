import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

export function createRedisClients() {
  const url = `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
  const pub = createClient({ url });
  const sub = createClient({ url });
  return { pub, sub };
}
