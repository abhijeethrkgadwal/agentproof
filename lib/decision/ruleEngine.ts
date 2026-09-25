import type { DecisionEngine, DecisionEngineResult } from "@/lib/decision/types";
import type { FeatureSnapshot } from "@/lib/features/types";
import {
  getChallengeRiskProfile,
  isNaturalChallengeType,
} from "@/lib/risk/profiles";
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

function adaptiveConfigForChallenge(
  challengeType: string,
  base: AdaptiveRuleConfig,
): AdaptiveRuleConfig {
  if (!isNaturalChallengeType(challengeType)) return base;
  // Natural challenges may finish soon after min-active with fewer frames
  // but need richer pointer telemetry than a single click.
  return {
    ...base,
    minFrames: Math.min(base.minFrames, 3),
    maxFrames: Math.max(base.maxFrames, 200),
    minInteractions: Math.max(base.minInteractions, 4),
  };
}

/**
 * Rule-based DecisionEngine with Phase 7 adaptive heuristics + Phase 10
 * challenge-type-aware thresholds. Ground truth is evaluated outside this
 * engine. No ML / Jev.
 */
export class RuleDecisionEngine implements DecisionEngine {
  readonly id = "rule_decision_engine_v3";

  constructor(private readonly config: AdaptiveRuleConfig = loadConfig()) {}

  evaluate(features: FeatureSnapshot): DecisionEngineResult {
    const profile = getChallengeRiskProfile(features.challengeType);
    const adaptive = adaptiveConfigForChallenge(
      features.challengeType,
      this.config,
    );

    const base = calculateRisk({
      challengeSolved: features.verified,
      completionTimeMs: features.completionTimeMs,
      failedAttempts: features.verified ? 0 : 1,
      retryCount: features.retryCount,
      interactionEventCount: features.interactionEventCount,
      challengeAgeMs: features.challengeAgeMs,
      framePollCount: features.frameCount,
      challengeType: features.challengeType,
    });

    const extra: Array<{ code: string; weight: number; detail: string }> = [
      ...base.factors,
    ];
    let bump = 0;

    // Timing - challenge-aware absolute floor (natural allows fast verified solves)
    if (features.completionTimeMs < profile.adaptiveTooFastMs) {
      bump += 0.25;
      extra.push({
        code: "adaptive_too_fast",
        weight: 0.25,
        detail: `Completion faster than credible ${profile.kind} observation window (${profile.adaptiveTooFastMs}ms)`,
      });
    }

    // Retries
    if (features.retryCount > adaptive.maxRetries) {
      bump += 0.2;
      extra.push({
        code: "adaptive_retries",
        weight: 0.2,
        detail: `retryCount ${features.retryCount} > ${adaptive.maxRetries}`,
      });
    }

    // Request cadence / frame volume
    if (features.frameCount > 0 && features.frameCount < adaptive.minFrames) {
      bump += 0.15;
      extra.push({
        code: "adaptive_sparse_frames",
        weight: 0.15,
        detail: `Only ${features.frameCount} frames observed`,
      });
    }
    if (features.frameCount > adaptive.maxFrames) {
      bump += 0.1;
      extra.push({
        code: "adaptive_dense_polling",
        weight: 0.1,
        detail: `frameCount ${features.frameCount} suggests aggressive polling`,
      });
    }

    // Interaction consistency - sparse remains suspicious for all types;
    // natural verified solves with rich pointer streams are not punished here.
    if (
      features.verified &&
      features.interactionEventCount < adaptive.minInteractions
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
    if (apiPerFrame > adaptive.maxApiPerFrame) {
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
