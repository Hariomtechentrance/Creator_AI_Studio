import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;
let redis: Redis | null = null;
if (REDIS_URL) redis = new Redis(REDIS_URL);

const WINDOW_MS = 60_000;
const MAX = 3;

async function checkLimitRedis(key: string) {
  if (!redis) return { ok: true };
  const now = Date.now();
  const window = Math.floor(now / WINDOW_MS);
  const redisKey = `rl:${key}:${window}`;
  const val = await redis.incr(redisKey);
  if (val === 1) await redis.pexpire(redisKey, WINDOW_MS);
  return { ok: val <= MAX };
}

const map = new Map<string, { count: number; reset: number }>();

function checkLimitMemory(key: string) {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || entry.reset <= now) {
    map.set(key, { count: 1, reset: now + WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= MAX) return { ok: false };
  entry.count += 1;
  return { ok: true };
}

export async function checkAndIncrement(key: string) {
  if (redis) return checkLimitRedis(key);
  return checkLimitMemory(key);
}
