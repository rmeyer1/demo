import { redis } from "../db/redis";

interface RateLimiterOptions {
  key: string;
  limit: number;
  window: number; // in seconds
}

export async function checkRateLimit(options: RateLimiterOptions): Promise<boolean> {
  const { key, limit, window } = options;
  const timestamp = Date.now();
  const expiry = timestamp + window * 1000;

  // Remove scores older than the window
  await redis.zremrangebyscore(key, 0, timestamp - window * 1000);

  // Add current request timestamp
  await redis.zadd(key, timestamp, `${timestamp}-${Math.random()}`);

  // Get current count
  const count = await redis.zcard(key);

  // Set expiry for the key if it's new
  if (count === 1) {
    await redis.expire(key, window);
  }

  return count <= limit;
}
