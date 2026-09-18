/**
 * Normalized server-side feature object for a completed verification.
 * Stored separately from raw telemetry so decision engines can swap later
 * without changing the challenge protocol.
 */
export type FeatureSnapshot = {
  challengeType: string;
  difficulty: number;
  completionTimeMs: number;
  frameCount: number;
  apiRequestCount: number;
  interactionEventCount: number;
  retryCount: number;
  challengeAgeMs: number;
  verified: boolean;
  decision: string;
};

/** Inputs used to build a snapshot (before decision is attached). */
export type FeatureSnapshotDraft = Omit<FeatureSnapshot, "decision"> & {
  decision?: string;
};
