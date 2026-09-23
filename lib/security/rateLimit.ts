import {
  getFrameRateLimitMaxRequests,
  getRateLimitMaxRequests,
  getRateLimitWindowMs,
} from "@/lib/config/env";
import { getRateLimitStore } from "@/lib/storage/rateLimitStore";

/** Rate limiter backed by RateLimitStore (memory or Redis). */
export async function checkRateLimit(
  key: string,
  nowMs: number = Date.now(),
  options?: { max?: number; windowMs?: number },
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  const windowMs = options?.windowMs ?? getRateLimitWindowMs();
  const max = options?.max ?? getRateLimitMaxRequests();
  return getRateLimitStore().hit(key, windowMs, max, nowMs);
}

/** Progressive frame polls — high ceiling so motion never freezes mid-challenge. */
export async function checkFrameRateLimit(
  key: string,
  nowMs: number = Date.now(),
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  return checkRateLimit(key, nowMs, {
    max: getFrameRateLimitMaxRequests(),
    windowMs: getRateLimitWindowMs(),
  });
}

/** Test helper to reset rate-limit state. */
export function resetRateLimits(): void {
  void getRateLimitStore().reset();
}
