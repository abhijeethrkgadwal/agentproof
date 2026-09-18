import type { DecisionEngine, DecisionEngineResult } from "@/lib/decision/types";
import type { FeatureSnapshot } from "@/lib/features/types";
import { calculateRisk } from "@/lib/risk/score";
import { bandForScore, decisionForBand } from "@/lib/risk/types";

export type AdaptiveRuleConfig = {
  /** Max completion time ratio vs expected (~duration). */
  maxTimingRatio: number;
  /** Min frames for a credible observation. */
  minFrames: number;
  /** Max frames before cadence looks automated. */
  maxFrames: number;
  /** Max retries before step-up. */
  maxRetries: number;
  /** Suspicious API-to-frame ratio (apiRequests / frames). */
  maxApiPerFrame: number;
  /** Sparse interaction threshold. */
  minInteractions: number;
};

function loadConfig(): AdaptiveRuleConfig {
  return {
    maxTimingRatio: Number(process.env.AGENTPROOF_RULE_MAX_TIMING_RATIO ?? "2.5"),
    minFrames: Number(process.env.AGENTPROOF_RULE_MIN_FRAMES ?? "8"),
    maxFrames: Number(process.env.AGENTPROOF_RULE_MAX_FRAMES ?? "80"),
    maxRetries: Number(process.env.AGENTPROOF_RULE_MAX_RETRIES ?? "2"),
    maxApiPerFrame: Number(process.env.AGENTPROOF_RULE_MAX_API_PER_FRAME ?? "3"),
    minInteractions: Number(process.env.AGENTPROOF_RULE_MIN_INTERACTIONS ?? "2"),
  };
}

/**
 * Rule-based DecisionEngine with Phase 7 adaptive heuristics.
 * Ground truth is evaluated outside this engine. No ML / Jev.
 */
export class RuleDecisionEngine implements DecisionEngine {
  readonly id = "rule_decision_engine_v2";

  constructor(private readonly config: AdaptiveRuleConfig = loadConfig()) {}

  evaluate(features: FeatureSnapshot): DecisionEngineResult {
    const base = calculateRisk({
      challengeSolved: features.verified,
      completionTimeMs: features.completionTimeMs,
      failedAttempts: features.verified ? 0 : 1,
      retryCount: features.retryCount,
      interactionEventCount: features.interactionEventCount,
      challengeAgeMs: features.challengeAgeMs,
      framePollCount: features.frameCount,
    });

    const extra: Array<{ code: string; weight: number; detail: string }> = [
      ...base.factors,
    ];
    let bump = 0;

    // Timing
    if (features.completionTimeMs < 1500) {
      bump += 0.25;
      extra.push({
        code: "adaptive_too_fast",
        weight: 0.25,
        detail: "Completion faster than credible observation window",
      });
    }

    // Retries
    if (features.retryCount > this.config.maxRetries) {
      bump += 0.2;
      extra.push({
        code: "adaptive_retries",
        weight: 0.2,
        detail: `retryCount ${features.retryCount} > ${this.config.maxRetries}`,
      });
    }

    // Request cadence / frame volume
    if (features.frameCount > 0 && features.frameCount < this.config.minFrames) {
      bump += 0.15;
      extra.push({
        code: "adaptive_sparse_frames",
        weight: 0.15,
        detail: `Only ${features.frameCount} frames observed`,
      });
    }
    if (features.frameCount > this.config.maxFrames) {
      bump += 0.1;
      extra.push({
        code: "adaptive_dense_polling",
        weight: 0.1,
        detail: `frameCount ${features.frameCount} suggests aggressive polling`,
      });
    }

    // Interaction consistency
    if (
      features.verified &&
      features.interactionEventCount < this.config.minInteractions
    ) {
      bump += 0.15;
      extra.push({
        code: "adaptive_sparse_interaction",
        weight: 0.15,
        detail: "Verified with unusually sparse interaction events",
      });
    }

    const apiPerFrame =
      features.frameCount > 0
        ? features.apiRequestCount / features.frameCount
        : features.apiRequestCount;
    if (apiPerFrame > this.config.maxApiPerFrame) {
      bump += 0.1;
      extra.push({
        code: "adaptive_api_cadence",
        weight: 0.1,
        detail: `api/frame ratio ${apiPerFrame.toFixed(2)}`,
      });
    }

    // Repeated challenge / stale session age
    if (features.challengeAgeMs > 90_000) {
      bump += 0.1;
      extra.push({
        code: "adaptive_stale_challenge",
        weight: 0.1,
        detail: "Challenge age exceeds typical session window",
      });
    }

    const riskScore = Math.min(1, Number((base.riskScore + bump).toFixed(4)));
    const classification = bandForScore(riskScore);
    const nextAction = decisionForBand(classification);

    return {
      riskScore,
      confidence: base.confidence,
      classification,
      nextAction,
      factors: extra,
    };
  }
}

let defaultEngine: DecisionEngine | null = null;

export function getDecisionEngine(): DecisionEngine {
  if (!defaultEngine) defaultEngine = new RuleDecisionEngine();
  return defaultEngine;
}

export function setDecisionEngineForTests(engine: DecisionEngine | null): void {
  defaultEngine = engine;
}
