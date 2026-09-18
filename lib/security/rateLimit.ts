import {
  getRateLimitMaxRequests,
  getRateLimitWindowMs,
} from "@/lib/config/env";
import { getRateLimitStore } from "@/lib/storage/rateLimitStore";

/** Rate limiter backed by RateLimitStore (memory or Redis). */
export async function checkRateLimit(
  key: string,
  nowMs: number = Date.now(),
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  const windowMs = getRateLimitWindowMs();
  const max = getRateLimitMaxRequests();
  return getRateLimitStore().hit(key, windowMs, max, nowMs);
}

/** Test helper to reset rate-limit state. */
export function resetRateLimits(): void {
  void getRateLimitStore().reset();
}
