export type AttackerLevel = "human" | "l1_api_observer" | "l2_browser" | "l3_vision";

export type LabRunStatus = "success" | "failure" | "error";

export type LabRunRecord = {
  runId: string;
  level: AttackerLevel;
  difficulty: number;
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
  /** Composite Automation Cost (documented formula). */
  automationCost: number;
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
 * Automation Cost = seconds + 0.5*actions + 0.1*framesObserved
 * Higher = more expensive to automate. Research metric only.
 */
export function computeAutomationCost(input: {
  timeToSolveMs: number;
  actions: number;
  framesObserved: number;
}): number {
  const seconds = input.timeToSolveMs / 1000;
  return Number(
    (seconds + input.actions * 0.5 + input.framesObserved * 0.1).toFixed(3),
  );
}
