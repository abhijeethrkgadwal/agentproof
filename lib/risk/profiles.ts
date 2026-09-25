/**
 * Challenge-type risk profiles.
 * Temporal / research keeps stricter click-style heuristics.
 * Natural interaction challenges expect dense pointer streams and
 * shorter credible completion windows once ground truth verifies.
 */

export type ChallengeRiskKind = "temporal" | "natural";

export type ChallengeRiskProfile = {
  kind: ChallengeRiskKind;
  /** Flag too_fast when solved and completion < expectedDuration * ratio. */
  tooFastRatio: number;
  /** Absolute floor for too_fast (ms) - catches scripted instant submits. */
  tooFastAbsoluteMs: number;
  tooFastWeight: number;
  /** Interaction events above this contribute excessive_interaction. */
  excessiveInteractionThreshold: number;
  excessiveInteractionWeight: number;
  /** Adaptive engine: completion below this is adaptive_too_fast. */
  adaptiveTooFastMs: number;
  /** Soft ceiling: events above this get a mild density bump only. */
  highDensitySoftCeiling: number;
};

const TEMPORAL_PROFILE: ChallengeRiskProfile = {
  kind: "temporal",
  tooFastRatio: 0.35,
  tooFastAbsoluteMs: 800,
  tooFastWeight: 0.28,
  excessiveInteractionThreshold: 40,
  excessiveInteractionWeight: 0.22,
  adaptiveTooFastMs: 1500,
  highDensitySoftCeiling: 80,
};

/** Pointer-heavy drag / physics / path challenges. */
const NATURAL_PROFILE: ChallengeRiskProfile = {
  kind: "natural",
  // Legitimate solves often finish soon after min-active (~1.2s).
  tooFastRatio: 0.08,
  tooFastAbsoluteMs: 450,
  tooFastWeight: 0.3,
  // Pathological volume only - ~60Hz pointer samples over several seconds
  // are expected and must not alone raise risk when verified.
  excessiveInteractionThreshold: 1800,
  excessiveInteractionWeight: 0.14,
  adaptiveTooFastMs: 500,
  /** Mild density signal starts here; hard excessive uses threshold above. */
  highDensitySoftCeiling: 900,
};

const NATURAL_TYPES = new Set([
  "drag_avoid",
  "physical",
  "dynamic_path",
]);

export function resolveChallengeRiskKind(
  challengeType: string | undefined,
): ChallengeRiskKind {
  if (challengeType && NATURAL_TYPES.has(challengeType)) return "natural";
  return "temporal";
}

export function getChallengeRiskProfile(
  challengeType: string | undefined,
): ChallengeRiskProfile {
  return resolveChallengeRiskKind(challengeType) === "natural"
    ? NATURAL_PROFILE
    : TEMPORAL_PROFILE;
}

export function isNaturalChallengeType(challengeType: string | undefined): boolean {
  return resolveChallengeRiskKind(challengeType) === "natural";
}
