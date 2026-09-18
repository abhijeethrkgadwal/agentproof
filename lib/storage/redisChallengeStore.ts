import type { StoredChallenge } from "@/lib/challenge/types";
import type { ChallengeStore } from "@/lib/storage/challengeStore";

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { EX?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
};

const PREFIX = "ap:challenge:";

/**
 * Redis-backed ChallengeStore. All methods are async-capable so replay
 * protection works across multiple Node processes.
 */
export class RedisBackedChallengeStore implements ChallengeStore {
  constructor(private readonly redis: RedisLike) {}

  private ttlSeconds(challenge: StoredChallenge): number {
    return Math.max(
      60,
      Math.ceil((new Date(challenge.expiresAt).getTime() - Date.now()) / 1000) +
        60,
    );
  }

  async createChallenge(challenge: StoredChallenge): Promise<void> {
    await this.redis.set(PREFIX + challenge.challengeId, JSON.stringify(challenge), {
      EX: this.ttlSeconds(challenge),
    });
  }

  async getChallenge(
    challengeId: string,
  ): Promise<StoredChallenge | undefined> {
    const raw = await this.redis.get(PREFIX + challengeId);
    if (!raw) return undefined;
    return JSON.parse(raw) as StoredChallenge;
  }

  async updateChallenge(
    challengeId: string,
    patch: Partial<StoredChallenge>,
  ): Promise<StoredChallenge | undefined> {
    const current = await this.getChallenge(challengeId);
    if (!current) return undefined;
    const next = { ...current, ...patch };
    await this.createChallenge(next);
    return next;
  }

  async consumeChallenge(challengeId: string): Promise<boolean> {
    const current = await this.getChallenge(challengeId);
    if (!current || current.consumed) return false;
    current.consumed = true;
    current.lifecycle = "submitted";
    await this.createChallenge(current);
    return true;
  }

  async isConsumed(challengeId: string): Promise<boolean> {
    const current = await this.getChallenge(challengeId);
    return current?.consumed === true;
  }

  async incrementFailedAttempts(challengeId: string): Promise<number> {
    const current = await this.getChallenge(challengeId);
    if (!current) return 0;
    current.failedAttempts += 1;
    await this.createChallenge(current);
    return current.failedAttempts;
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    await this.redis.del(PREFIX + challengeId);
  }

  async purgeExpired(): Promise<number> {
    return 0; // TTL handles expiry in Redis
  }

  async clear(): Promise<void> {
    const keys = await this.redis.keys(PREFIX + "*");
    for (const key of keys) await this.redis.del(key);
  }

  async size(): Promise<number> {
    const keys = await this.redis.keys(PREFIX + "*");
    return keys.length;
  }
}
