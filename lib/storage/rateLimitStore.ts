export interface RateLimitStore {
  /**
   * Record a hit for `key` in the current window.
   * Returns whether the request is allowed and retry-after if not.
   */
  hit(
    key: string,
    windowMs: number,
    max: number,
    nowMs?: number,
  ):
    | Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }>
    | { allowed: true }
    | { allowed: false; retryAfterMs: number };

  reset(): Promise<void> | void;
}

type Bucket = { count: number; windowStart: number };

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  hit(
    key: string,
    windowMs: number,
    max: number,
    nowMs: number = Date.now(),
  ): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const existing = this.buckets.get(key);
    if (!existing || nowMs - existing.windowStart >= windowMs) {
      this.buckets.set(key, { count: 1, windowStart: nowMs });
      return { allowed: true };
    }
    if (existing.count >= max) {
      return {
        allowed: false,
        retryAfterMs: windowMs - (nowMs - existing.windowStart),
      };
    }
    existing.count += 1;
    return { allowed: true };
  }

  reset(): void {
    this.buckets.clear();
  }
}

declare global {
  var __agentproofRateLimitStore: RateLimitStore | undefined;
}

export function getRateLimitStore(): RateLimitStore {
  if (!globalThis.__agentproofRateLimitStore) {
    globalThis.__agentproofRateLimitStore = new InMemoryRateLimitStore();
  }
  return globalThis.__agentproofRateLimitStore;
}

export function setRateLimitStoreForTests(store: RateLimitStore | null): void {
  globalThis.__agentproofRateLimitStore = store ?? undefined;
}
