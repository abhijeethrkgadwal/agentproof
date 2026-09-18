import {
  getRateLimitMaxRequests,
  getRateLimitWindowMs,
} from "@/lib/config/env";

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

/** Simple in-memory sliding-window rate limiter (per key). */
export function checkRateLimit(
  key: string,
  nowMs: number = Date.now(),
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const windowMs = getRateLimitWindowMs();
  const max = getRateLimitMaxRequests();
  const existing = buckets.get(key);

  if (!existing || nowMs - existing.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: nowMs });
    return { allowed: true };
  }

  if (existing.count >= max) {
    const retryAfterMs = windowMs - (nowMs - existing.windowStart);
    return { allowed: false, retryAfterMs };
  }

  existing.count += 1;
  return { allowed: true };
}

/** Test helper to reset rate-limit state. */
export function resetRateLimits(): void {
  buckets.clear();
}
