import type { DecisionEngine, DecisionEngineResult } from "@/lib/decision/types";
import type { FeatureSnapshot } from "@/lib/features/types";
import { calculateRisk } from "@/lib/risk/score";

/**
 * Rule-based DecisionEngine wrapping the existing deterministic risk rules.
 * No ML / Jev. Ground truth is evaluated outside this engine.
 */
export class RuleDecisionEngine implements DecisionEngine {
  readonly id = "rule_decision_engine_v1";

  evaluate(features: FeatureSnapshot): DecisionEngineResult {
    const risk = calculateRisk({
      challengeSolved: features.verified,
      completionTimeMs: features.completionTimeMs,
      failedAttempts: features.verified ? 0 : 1,
      retryCount: features.retryCount,
      interactionEventCount: features.interactionEventCount,
      challengeAgeMs: features.challengeAgeMs,
      framePollCount: features.frameCount,
    });

    return {
      riskScore: risk.riskScore,
      confidence: risk.confidence,
      classification: risk.band,
      nextAction: risk.decision,
      factors: risk.factors,
    };
  }
}

let defaultEngine: DecisionEngine | null = null;

export function getDecisionEngine(): DecisionEngine {
  if (!defaultEngine) defaultEngine = new RuleDecisionEngine();
  return defaultEngine;
}

/** Test helper — inject an alternate engine without changing API contracts. */
export function setDecisionEngineForTests(engine: DecisionEngine | null): void {
  defaultEngine = engine;
}
