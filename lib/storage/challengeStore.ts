import type { StoredChallenge } from "@/lib/challenge/types";

export interface ChallengeStore {
  createChallenge(challenge: StoredChallenge): void;
  getChallenge(challengeId: string): StoredChallenge | undefined;
  consumeChallenge(challengeId: string): boolean;
  isConsumed(challengeId: string): boolean;
  incrementFailedAttempts(challengeId: string): number;
  deleteChallenge(challengeId: string): void;
  /** Drop expired challenges (and optionally stale consumed ones). */
  purgeExpired(now?: Date): number;
  clear(): void;
  size(): number;
}

/**
 * In-memory challenge store for local MVP.
 * Interface is Redis/Postgres-ready for later backends.
 */
export class InMemoryChallengeStore implements ChallengeStore {
  private readonly challenges = new Map<string, StoredChallenge>();

  createChallenge(challenge: StoredChallenge): void {
    this.challenges.set(challenge.challengeId, { ...challenge });
  }

  getChallenge(challengeId: string): StoredChallenge | undefined {
    const found = this.challenges.get(challengeId);
    return found ? { ...found, groundTruth: { ...found.groundTruth }, renderConfiguration: { ...found.renderConfiguration, objects: found.renderConfiguration.objects.map((o) => ({ ...o, segments: o.segments.map((s) => ({ ...s, velocity: { ...s.velocity } })), start: { ...o.start } })) } } : undefined;
  }

  consumeChallenge(challengeId: string): boolean {
    const found = this.challenges.get(challengeId);
    if (!found || found.consumed) return false;
    found.consumed = true;
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
  var __agentproofChallengeStore: InMemoryChallengeStore | undefined;
}

export function getChallengeStore(): ChallengeStore {
  if (!globalThis.__agentproofChallengeStore) {
    globalThis.__agentproofChallengeStore = new InMemoryChallengeStore();
  }
  return globalThis.__agentproofChallengeStore;
}
