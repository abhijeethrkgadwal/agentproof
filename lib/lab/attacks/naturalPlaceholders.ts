import { computeAutomationCost, type AttackRunRecord } from "@/lib/lab/types";

/**
 * Placeholder attacker stubs for v0.2 natural challenges.
 * Do NOT fabricate success rates — these always record as not-implemented.
 */
export async function runNaturalChallengePlaceholder(options: {
  challengeType: "drag_avoid" | "physical" | "dynamic_path";
  difficulty?: number;
}): Promise<Omit<AttackRunRecord, "runId" | "timestamp">> {
  const attackName =
    options.challengeType === "drag_avoid"
      ? "drag_avoid_placeholder"
      : options.challengeType === "physical"
        ? "physical_placeholder"
        : "dynamic_path_placeholder";

  return {
    attackLevel: "lab_v2",
    attackName,
    challengeDifficulty: options.difficulty ?? 1,
    challengeType: options.challengeType,
    success: false,
    solveTimeMs: 0,
    frameCount: 0,
    apiRequestCount: 0,
    interactionCount: 0,
    retryCount: 0,
    failureReason: "attacker_not_implemented",
    automationCost: computeAutomationCost({
      timeToSolveMs: 0,
      framesObserved: 0,
      apiRequestCount: 0,
      interactionCount: 0,
    }),
    notes: `Placeholder only — no automated attacker for ${options.challengeType} yet. No fake benchmark data.`,
  };
}
