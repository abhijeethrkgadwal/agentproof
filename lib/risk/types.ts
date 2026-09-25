export type RiskDecision = "allow" | "step_up" | "restrict";

export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

export type RiskInputs = {
  challengeSolved: boolean;
  completionTimeMs: number;
  failedAttempts: number;
  retryCount: number;
  interactionEventCount: number;
  challengeAgeMs: number;
  /**
   * Challenge type (temporal / drag_avoid / physical / dynamic_path).
   * Selects challenge-aware risk thresholds; defaults to temporal heuristics.
   */
  challengeType?: string;
  /** Expected challenge animation duration - used for timing heuristics. */
  expectedDurationMs?: number;
  /** Server-observed active window (ms). */
  serverActiveMs?: number;
  /** Number of progressive frame polls observed server-side. */
  framePollCount?: number;
  /** Whether verify presented a matching session cookie. */
  sessionBound?: boolean;
};

export type RiskFactor = {
  code: string;
  weight: number;
  detail: string;
};

export type RiskResult = {
  /** Interaction risk score in [0, 1]. Not a probability of being human. */
  riskScore: number;
  confidence: number;
  band: RiskBand;
  decision: RiskDecision;
  factors: RiskFactor[];
};

export function bandForScore(score: number): RiskBand {
  if (score < 0.3) return "LOW";
  if (score < 0.7) return "MEDIUM";
  return "HIGH";
}

export function decisionForBand(band: RiskBand): RiskDecision {
  switch (band) {
    case "LOW":
      return "allow";
    case "MEDIUM":
      return "step_up";
    case "HIGH":
      return "restrict";
  }
}
