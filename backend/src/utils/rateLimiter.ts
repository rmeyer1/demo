type RateLimitState = { count: number; resetAt: number };

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

const buckets = new Map<string, RateLimitState>();

export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return true;
  }

  if (existing.count >= config.max) {
    return false;
  }

  existing.count += 1;
  return true;
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
