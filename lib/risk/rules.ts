import { getChallengeRiskProfile } from "@/lib/risk/profiles";
import type { RiskFactor, RiskInputs } from "@/lib/risk/types";

/**
 * Explainable rule contributions. Weights are additive before clamp.
 * Normal successful human interaction should generally land LOW.
 *
 * Temporal (v0.1) keeps click/observation heuristics.
 * Natural challenges (v0.2) expect dense pointer streams; high event
 * counts alone are not treated as automation when the solve verifies.
 */
export function evaluateRiskFactors(inputs: RiskInputs): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const expected = inputs.expectedDurationMs ?? 5000;
  const profile = getChallengeRiskProfile(inputs.challengeType);

  if (!inputs.challengeSolved) {
    factors.push({
      code: "incorrect_answer",
      weight: 0.55,
      detail: "Selected object did not match server ground truth",
    });
  }

  if (inputs.failedAttempts > 0) {
    factors.push({
      code: "failed_attempts",
      weight: Math.min(0.35, inputs.failedAttempts * 0.12),
      detail: `${inputs.failedAttempts} prior failed attempt(s)`,
    });
  }

  if (inputs.retryCount > 0) {
    factors.push({
      code: "retries",
      weight: Math.min(0.25, inputs.retryCount * 0.1),
      detail: `${inputs.retryCount} retry(ies)`,
    });
  }

  // Extremely fast completion - thresholds are challenge-type-aware.
  // Verified natural solves may finish soon after min-active; only
  // near-instant / scripted times are flagged.
  const tooFastByRatio =
    inputs.completionTimeMs < expected * profile.tooFastRatio;
  const tooFastAbsolute =
    inputs.completionTimeMs < profile.tooFastAbsoluteMs;
  if (
    inputs.challengeSolved &&
    (tooFastAbsolute || tooFastByRatio)
  ) {
    factors.push({
      code: "too_fast",
      weight: profile.tooFastWeight,
      detail: `Completed in ${inputs.completionTimeMs}ms (expected ~${expected}ms, ${profile.kind} profile)`,
    });
  }

  // Instant click / no real interaction - suspicious for all types.
  if (inputs.challengeSolved && inputs.interactionEventCount <= 1) {
    factors.push({
      code: "sparse_interaction",
      weight: 0.18,
      detail: "Very few interaction events recorded",
    });
  }

  // Excessively many events: temporal uses a low ceiling (scripted probing).
  // Natural pointer streams routinely exceed temporal's ceiling; only
  // pathological volume is treated as suspicious automation.
  if (inputs.interactionEventCount > profile.excessiveInteractionThreshold) {
    factors.push({
      code: "excessive_interaction",
      weight: profile.excessiveInteractionWeight,
      detail: `${inputs.interactionEventCount} interaction events (${profile.kind} threshold ${profile.excessiveInteractionThreshold})`,
    });
  } else if (
    profile.kind === "natural" &&
    inputs.interactionEventCount > profile.highDensitySoftCeiling
  ) {
    // Mild density signal between soft ceiling and hard excessive threshold.
    factors.push({
      code: "pointer_density_elevated",
      weight: 0.06,
      detail: `${inputs.interactionEventCount} pointer events (soft ceiling ${profile.highDensitySoftCeiling})`,
    });
  }

  // Very old challenge at verification time (near expiry)
  if (inputs.challengeAgeMs > 45_000) {
    factors.push({
      code: "stale_challenge",
      weight: 0.12,
      detail: `Challenge age ${inputs.challengeAgeMs}ms`,
    });
  }

  // Server-observed short active window despite client claiming otherwise
  if (
    inputs.challengeSolved &&
    typeof inputs.serverActiveMs === "number" &&
    inputs.serverActiveMs < expected * 0.5
  ) {
    // Natural challenges legitimately finish well under half of durationMs.
    if (profile.kind === "temporal") {
      factors.push({
        code: "short_server_active",
        weight: 0.3,
        detail: `Server active window ${inputs.serverActiveMs}ms`,
      });
    } else if (inputs.serverActiveMs < profile.tooFastAbsoluteMs) {
      factors.push({
        code: "short_server_active",
        weight: 0.22,
        detail: `Server active window ${inputs.serverActiveMs}ms (natural floor)`,
      });
    }
  }

  // Few frame polls → likely non-interactive / scripted verify path
  if (
    inputs.challengeSolved &&
    typeof inputs.framePollCount === "number" &&
    inputs.framePollCount < 3
  ) {
    factors.push({
      code: "low_frame_polls",
      weight: 0.22,
      detail: `Only ${inputs.framePollCount} progressive frame poll(s)`,
    });
  }

  if (inputs.sessionBound === false) {
    factors.push({
      code: "session_unbound",
      weight: 0.35,
      detail: "Verify lacked matching short-lived session cookie",
    });
  }

  // Baseline friction for solved challenges keeps score in LOW band
  if (inputs.challengeSolved && factors.length === 0) {
    factors.push({
      code: "baseline",
      weight: 0.08,
      detail: "Nominal successful interaction",
    });
  }

  return factors;
}
