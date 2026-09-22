export type LabChallengeType =
  | "temporal"
  | "drag_avoid"
  | "physical"
  | "dynamic_path";

export type AttackerLevel =
  | "human"
  | "human_study"
  | "l1_api_observer"
  | "l2_browser"
  | "l3_vision"
  | "lab_v2";

export type LabRunStatus = "success" | "failure" | "error";

export type LabRunRecord = {
  runId: string;
  level: AttackerLevel;
  difficulty: number;
  /** Challenge family under test (v0.2). Defaults to temporal for historical runs. */
  challengeType?: LabChallengeType;
  challengeId?: string;
  status: LabRunStatus;
  success: boolean;
  timeToSolveMs: number;
  apiCalls: number;
  framesObserved: number;
  actions: number;
  verificationResult?: {
    verified?: boolean;
    decision?: string;
    riskScore?: number;
    error?: string;
    status?: number;
  };
  notes?: string;
  createdAt: string;
  /** Composite Automation Cost (documented formula). Research metric only. */
  automationCost: number;
  /** Optional Lab V2 attack name when level === lab_v2 */
  attackName?: AttackName;
  failureReason?: string;
  retryCount?: number;
  source?: "synthetic_placeholder" | "human_study" | "automated";
};

export type AttackName =
  | "frame_reconstruction_v2"
  | "polling_optimisation"
  | "timing_attack"
  | "direct_api_attack"
  | "state_inference"
  | "replay_tampering"
  /** Placeholders for v0.2 natural challenges — no attacker implementation yet. */
  | "drag_avoid_placeholder"
  | "physical_placeholder"
  | "dynamic_path_placeholder";

/**
 * Persisted attack-run schema (Phase 6 Lab V2).
 * Never store secrets or unnecessary client data.
 */
export type AttackRunRecord = {
  runId: string;
  attackLevel: string;
  attackName: AttackName;
  challengeDifficulty: number;
  challengeType?: LabChallengeType;
  success: boolean;
  solveTimeMs: number;
  frameCount: number;
  apiRequestCount: number;
  interactionCount: number;
  retryCount: number;
  failureReason: string | null;
  timestamp: string;
  automationCost: number;
  challengeId?: string;
  notes?: string;
};

export type BenchmarkRow = {
  level: AttackerLevel;
  runs: number;
  successRate: number;
  medianSolveMs: number | null;
  p95SolveMs: number | null;
  medianFrames: number | null;
  medianApiCalls: number | null;
  medianActions: number | null;
  medianAutomationCost: number | null;
};

/**
 * Automation Cost — normalized experimental metric ONLY.
 * Not a universal security score. Not “probability of being human.”
 *
 * Formula:
 *   timeToSolveMs/1000
 *   + 0.5 * interactionCount
 *   + 0.1 * framesObserved
 *   + 0.05 * apiRequestCount
 *
 * `actions` is accepted as an alias for interactionCount (Phase 4 compat).
 */
export function computeAutomationCost(input: {
  timeToSolveMs: number;
  framesObserved: number;
  apiRequestCount?: number;
  apiCalls?: number;
  interactionCount?: number;
  actions?: number;
}): number {
  const seconds = input.timeToSolveMs / 1000;
  const interactions = input.interactionCount ?? input.actions ?? 0;
  const api = input.apiRequestCount ?? input.apiCalls ?? 0;
  return Number(
    (
      seconds +
      interactions * 0.5 +
      input.framesObserved * 0.1 +
      api * 0.05
    ).toFixed(3),
  );
}

export const AUTOMATION_COST_FORMULA =
  "AutomationCost = timeToSolveMs/1000 + 0.5*interactionCount + 0.1*framesObserved + 0.05*apiRequestCount";

/** Recognized Lab challenge identifiers (v0.2). */
export const LAB_CHALLENGE_TYPES: LabChallengeType[] = [
  "temporal",
  "drag_avoid",
  "physical",
  "dynamic_path",
];
