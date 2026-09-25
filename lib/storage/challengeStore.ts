/**
 * Challenge store - memory (local/tests) or Redis (multi-process).
 * Methods may be sync or async; callers always await.
 */
import type { StoredChallenge } from "@/lib/challenge/types";
import { getStorageBackend } from "@/lib/config/env";

export interface ChallengeStore {
  createChallenge(challenge: StoredChallenge): Promise<void> | void;
  getChallenge(
    challengeId: string,
  ): Promise<StoredChallenge | undefined> | StoredChallenge | undefined;
  updateChallenge(
    challengeId: string,
    patch: Partial<StoredChallenge>,
  ): Promise<StoredChallenge | undefined> | StoredChallenge | undefined;
  consumeChallenge(challengeId: string): Promise<boolean> | boolean;
  isConsumed(challengeId: string): Promise<boolean> | boolean;
  incrementFailedAttempts(challengeId: string): Promise<number> | number;
  deleteChallenge(challengeId: string): Promise<void> | void;
  purgeExpired(now?: Date): Promise<number> | number;
  clear(): Promise<void> | void;
  size(): Promise<number> | number;
}

function cloneChallenge(found: StoredChallenge): StoredChallenge {
  return structuredClone(found);
}

export class InMemoryChallengeStore implements ChallengeStore {
  private readonly challenges = new Map<string, StoredChallenge>();

  createChallenge(challenge: StoredChallenge): void {
    this.challenges.set(challenge.challengeId, cloneChallenge(challenge));
  }

  getChallenge(challengeId: string): StoredChallenge | undefined {
    const found = this.challenges.get(challengeId);
    return found ? cloneChallenge(found) : undefined;
  }

  updateChallenge(
    challengeId: string,
    patch: Partial<StoredChallenge>,
  ): StoredChallenge | undefined {
    const found = this.challenges.get(challengeId);
    if (!found) return undefined;
    Object.assign(found, patch);
    return cloneChallenge(found);
  }

  consumeChallenge(challengeId: string): boolean {
    const found = this.challenges.get(challengeId);
    if (!found || found.consumed) return false;
    found.consumed = true;
    found.lifecycle = "submitted";
    return true;
  }

  isConsumed(challengeId: string): boolean {
    return this.challenges.get(challengeId)?.consumed === true;
  }

  incrementFailedAttempts(challengeId: string): number {
    const found = this.challenges.get(challengeId);
    if (!found) return 0;
    found.failedAttempts += 1;
    return found.failedAttempts;
  }

  deleteChallenge(challengeId: string): void {
    this.challenges.delete(challengeId);
  }

  purgeExpired(now: Date = new Date()): number {
    const nowMs = now.getTime();
    let removed = 0;
    for (const [id, challenge] of this.challenges.entries()) {
      const expired = new Date(challenge.expiresAt).getTime() < nowMs - 60_000;
      if (expired) {
        this.challenges.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  clear(): void {
    this.challenges.clear();
  }

  size(): number {
    return this.challenges.size;
  }
}

declare global {
  var __agentproofChallengeStore: ChallengeStore | undefined;
}

export function getChallengeStore(): ChallengeStore {
  if (!globalThis.__agentproofChallengeStore) {
    globalThis.__agentproofChallengeStore = new InMemoryChallengeStore();
  }
  return globalThis.__agentproofChallengeStore;
}

export function setChallengeStoreForTests(store: ChallengeStore | null): void {
  globalThis.__agentproofChallengeStore = store ?? undefined;
}

/**
 * Initialize storage backends from env. Safe to call on boot.
 * Redis is optional - falls back to memory if unavailable.
 */
export async function initStorageBackends(): Promise<{
  backend: "memory" | "redis";
  redis: boolean;
}> {
  if (getStorageBackend() !== "redis") {
    return { backend: "memory", redis: false };
  }
  try {
    const { getRedisClient, RedisSessionStore, RedisRateLimitStore } =
      await import("@/lib/storage/redis");
    const { setSessionStoreForTests } = await import("@/lib/security/session");
    const { setRateLimitStoreForTests } = await import(
      "@/lib/storage/rateLimitStore"
    );
    const client = await getRedisClient();
    if (!client) {
      return { backend: "memory", redis: false };
    }
    // Challenge store: use Redis-backed async adapter
    const { RedisBackedChallengeStore } = await import(
      "@/lib/storage/redisChallengeStore"
    );
    globalThis.__agentproofChallengeStore = new RedisBackedChallengeStore(
      client,
    );
    setSessionStoreForTests(new RedisSessionStore(client));
    setRateLimitStoreForTests(new RedisRateLimitStore(client));
    return { backend: "redis", redis: true };
  } catch {
    return { backend: "memory", redis: false };
  }
}
