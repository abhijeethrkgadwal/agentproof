import type { FeatureSnapshot } from "@/lib/features/types";

/**
 * Decision engine interface - ground-truth verification stays SEPARATE.
 * Engines only score interaction risk / next action from features.
 */
export type DecisionEngineResult = {
  riskScore: number;
  confidence: number;
  classification: "LOW" | "MEDIUM" | "HIGH";
  nextAction: "allow" | "step_up" | "restrict";
  factors?: Array<{ code: string; weight: number; detail: string }>;
};

export interface DecisionEngine {
  readonly id: string;
  evaluate(features: FeatureSnapshot): DecisionEngineResult;
}
