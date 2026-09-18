import { evaluateRiskFactors } from "@/lib/risk/rules";
import {
  bandForScore,
  decisionForBand,
  type RiskInputs,
  type RiskResult,
} from "@/lib/risk/types";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Rule-based interaction risk score (0–1).
 * Isolated so it can later be replaced with an ML/anomaly model.
 */
export function calculateRisk(inputs: RiskInputs): RiskResult {
  const factors = evaluateRiskFactors(inputs);
  const raw = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const riskScore = clamp01(Number(raw.toFixed(4)));
  const band = bandForScore(riskScore);
  const decision = decisionForBand(band);

  // Confidence rises when we have enough telemetry and a clear outcome
  const telemetrySignal = Math.min(1, inputs.interactionEventCount / 8);
  const outcomeSignal = inputs.challengeSolved ? 0.7 : 0.55;
  const confidence = clamp01(
    Number((0.35 + 0.35 * outcomeSignal + 0.3 * telemetrySignal).toFixed(4)),
  );

  return {
    riskScore,
    confidence,
    band,
    decision,
    factors,
  };
}
