import type { ChallengeStore } from "@/lib/storage/challengeStore";

export async function assertNotConsumed(
  store: ChallengeStore,
  challengeId: string,
): Promise<{ ok: true } | { ok: false; error: "replay" }> {
  if (await store.isConsumed(challengeId)) {
    return { ok: false, error: "replay" };
  }
  return { ok: true };
}
