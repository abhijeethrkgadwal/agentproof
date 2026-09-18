import type { RiskFactor, RiskInputs } from "@/lib/risk/types";

/**
 * Explainable rule contributions. Weights are additive before clamp.
 * Normal successful human interaction should generally land LOW.
 */
export function evaluateRiskFactors(inputs: RiskInputs): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const expected = inputs.expectedDurationMs ?? 5000;

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

  // Extremely fast completion relative to animation is suspicious
  if (inputs.challengeSolved && inputs.completionTimeMs < expected * 0.35) {
    factors.push({
      code: "too_fast",
      weight: 0.28,
      detail: `Completed in ${inputs.completionTimeMs}ms (expected ~${expected}ms)`,
    });
  }

  // Instant click with almost no interaction events
  if (inputs.challengeSolved && inputs.interactionEventCount <= 1) {
    factors.push({
      code: "sparse_interaction",
      weight: 0.18,
      detail: "Very few interaction events recorded",
    });
  }

  // Excessively many events can indicate scripted probing
  if (inputs.interactionEventCount > 40) {
    factors.push({
      code: "excessive_interaction",
      weight: 0.22,
      detail: `${inputs.interactionEventCount} interaction events`,
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
    factors.push({
      code: "short_server_active",
      weight: 0.3,
      detail: `Server active window ${inputs.serverActiveMs}ms`,
    });
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
