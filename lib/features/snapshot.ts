import type { FeatureSnapshot, FeatureSnapshotDraft } from "@/lib/features/types";

export function createFeatureSnapshot(
  draft: FeatureSnapshotDraft & { decision: string },
): FeatureSnapshot {
  return {
    challengeType: draft.challengeType,
    difficulty: draft.difficulty,
    completionTimeMs: Math.max(0, Math.round(draft.completionTimeMs)),
    frameCount: Math.max(0, Math.round(draft.frameCount)),
    apiRequestCount: Math.max(0, Math.round(draft.apiRequestCount)),
    interactionEventCount: Math.max(0, Math.round(draft.interactionEventCount)),
    retryCount: Math.max(0, Math.round(draft.retryCount)),
    challengeAgeMs: Math.max(0, Math.round(draft.challengeAgeMs)),
    verified: Boolean(draft.verified),
    decision: draft.decision,
  };
}
