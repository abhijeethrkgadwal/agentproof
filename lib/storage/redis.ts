/**
 * Redis-backed stores for multi-process production.
 * Activated when AGENTPROOF_STORAGE_BACKEND=redis and AGENTPROOF_REDIS_URL is set.
 */
import type { RateLimitStore } from "@/lib/storage/rateLimitStore";
import type { SessionRecord, SessionStore } from "@/lib/security/session";

export type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { EX?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  quit(): Promise<unknown>;
  connect?: () => Promise<unknown>;
};

let redisClient: RedisLike | null = null;
let redisInitError: string | null = null;

export function getRedisInitError(): string | null {
  return redisInitError;
}

export async function getRedisClient(): Promise<RedisLike | null> {
  if (redisClient) return redisClient;
  const url = process.env.AGENTPROOF_REDIS_URL ?? process.env.REDIS_URL;
  if (!url) {
    redisInitError = "missing_redis_url";
    return null;
  }
  try {
    const mod = await import("ioredis");
    const Redis = mod.default;
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    if (typeof client.connect === "function") {
      await client.connect();
    }
    redisClient = client as unknown as RedisLike;
    redisInitError = null;
    return redisClient;
  } catch (err) {
    redisInitError =
      err instanceof Error ? err.message : "redis_connect_failed";
    return null;
  }
}

const SID_PREFIX = "ap:session:";
const RL_PREFIX = "ap:rl:";

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: RedisLike) {}

  async put(record: SessionRecord): Promise<void> {
    const ttl = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000));
    await this.redis.set(SID_PREFIX + record.sessionId, JSON.stringify(record), {
      EX: ttl,
    });
  }

  async get(sessionId: string): Promise<SessionRecord | undefined> {
    const raw = await this.redis.get(SID_PREFIX + sessionId);
    if (!raw) return undefined;
    return JSON.parse(raw) as SessionRecord;
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(SID_PREFIX + sessionId);
  }

  async clear(): Promise<void> {
    const keys = await this.redis.keys(SID_PREFIX + "*");
    for (const key of keys) await this.redis.del(key);
  }
}

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: RedisLike) {}

  async hit(
    key: string,
    windowMs: number,
    max: number,
  ): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
    const redisKey = RL_PREFIX + key;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, Math.ceil(windowMs / 1000));
    }
    if (count > max) {
      const ttl = await this.redis.ttl(redisKey);
      return {
        allowed: false,
        retryAfterMs: Math.max(0, ttl) * 1000,
      };
    }
    return { allowed: true };
  }

  async reset(): Promise<void> {
    const keys = await this.redis.keys(RL_PREFIX + "*");
    for (const key of keys) await this.redis.del(key);
  }
}
