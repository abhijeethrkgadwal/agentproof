import type { ChallengeStore } from "@/lib/storage/challengeStore";

export function assertNotConsumed(
  store: ChallengeStore,
  challengeId: string,
): { ok: true } | { ok: false; error: "replay" } {
  if (store.isConsumed(challengeId)) {
    return { ok: false, error: "replay" };
  }
  return { ok: true };
}
