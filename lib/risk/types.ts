export type RiskDecision = "allow" | "step_up" | "restrict";

export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

export type RiskInputs = {
  challengeSolved: boolean;
  completionTimeMs: number;
  failedAttempts: number;
  retryCount: number;
  interactionEventCount: number;
  challengeAgeMs: number;
  /** Expected challenge animation duration — used for timing heuristics. */
  expectedDurationMs?: number;
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
