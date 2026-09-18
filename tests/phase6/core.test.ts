import { describe, expect, it } from "vitest";
import { createFeatureSnapshot } from "@/lib/features/snapshot";
import { RuleDecisionEngine } from "@/lib/decision/ruleEngine";
import { computeAutomationCost } from "@/lib/lab/types";
import { aggregateStudyAttempts } from "@/lib/study/aggregate";
import type { StudyAttempt } from "@/lib/study/types";
import {
  countChangesAdaptive,
  lowPassSeries,
  reconstructPath,
  smoothTrail,
} from "@/lib/lab/attacks/adaptiveTrail";
import { appendAttackRun, clearAttackRunsForTests, listAttackRuns } from "@/lib/lab/attackStore";

describe("feature snapshot", () => {
  it("creates a normalized snapshot", () => {
    const snap = createFeatureSnapshot({
      challengeType: "temporal_object_tracking",
      difficulty: 1,
      completionTimeMs: 5120.4,
      frameCount: 41,
      apiRequestCount: 44,
      interactionEventCount: 6,
      retryCount: 0,
      challengeAgeMs: 6000,
      verified: true,
      decision: "allow",
    });
    expect(snap.completionTimeMs).toBe(5120);
    expect(snap.verified).toBe(true);
    expect(snap.decision).toBe("allow");
  });
});

describe("RuleDecisionEngine", () => {
  it("evaluates features without claiming human probability", () => {
    const engine = new RuleDecisionEngine();
    const result = engine.evaluate(
      createFeatureSnapshot({
        challengeType: "temporal_object_tracking",
        difficulty: 1,
        completionTimeMs: 5200,
        frameCount: 40,
        apiRequestCount: 44,
        interactionEventCount: 6,
        retryCount: 0,
        challengeAgeMs: 6000,
        verified: true,
        decision: "pending",
      }),
    );
    expect(result.classification).toBe("LOW");
    expect(result.nextAction).toBe("allow");
    expect(result.riskScore).toBeLessThan(0.3);
  });
});

describe("automation cost", () => {
  it("includes time, interactions, frames, and API calls", () => {
    const cost = computeAutomationCost({
      timeToSolveMs: 5000,
      interactionCount: 2,
      framesObserved: 40,
      apiRequestCount: 44,
    });
    // 5 + 1 + 4 + 2.2 = 12.2
    expect(cost).toBe(12.2);
  });
});

describe("study aggregation", () => {
  it("aggregates without exposing individuals", () => {
    const attempts: StudyAttempt[] = [
      {
        attemptId: "a1",
        participantId: "p1",
        challengeId: "c1",
        difficulty: 1,
        success: true,
        completionTimeMs: 6000,
        retryCount: 0,
        interactionEventCount: 5,
        framesObserved: 40,
        accessibilityPathUsed: false,
        abandoned: false,
        timestamp: new Date().toISOString(),
      },
      {
        attemptId: "a2",
        participantId: "p2",
        challengeId: "c2",
        difficulty: 1,
        success: false,
        completionTimeMs: 7000,
        retryCount: 1,
        interactionEventCount: 4,
        framesObserved: 38,
        accessibilityPathUsed: true,
        abandoned: false,
        timestamp: new Date().toISOString(),
      },
      {
        attemptId: "a3",
        participantId: "p1",
        challengeId: "c3",
        difficulty: 2,
        success: false,
        completionTimeMs: 1000,
        retryCount: 0,
        interactionEventCount: 1,
        framesObserved: 5,
        accessibilityPathUsed: false,
        abandoned: true,
        timestamp: new Date().toISOString(),
      },
    ];
    const agg = aggregateStudyAttempts(attempts);
    expect(agg.participantCount).toBe(2);
    expect(agg.attempts).toBe(3);
    expect(agg.label).toContain("Observational pilot");
    expect(agg.successRate).toBe(0.5);
    expect(Object.keys(agg)).not.toContain("participantId");
  });
});

describe("adaptive smoothing attacker helpers", () => {
  it("low-pass and reconstruct a noisy trail", () => {
    const series = [0, 10, 2, 12, 4, 14];
    const smooth = lowPassSeries(series, 0.5);
    expect(smooth.length).toBe(series.length);
    const trail = [
      { t: 0, x: 0, y: 0 },
      { t: 200, x: 40, y: 0 },
      { t: 400, x: 40, y: 40 },
      { t: 600, x: 0, y: 40 },
    ];
    const smoothed = smoothTrail(trail, 0.4);
    const path = reconstructPath(smoothed, 100);
    expect(path.length).toBeGreaterThan(trail.length);
    expect(countChangesAdaptive(trail)).toBeGreaterThanOrEqual(1);
  });
});

describe("attack result recording", () => {
  it("persists attack runs without secrets", () => {
    clearAttackRunsForTests();
    const row = appendAttackRun({
      attackLevel: "lab_v2",
      attackName: "direct_api_attack",
      challengeDifficulty: 1,
      success: false,
      solveTimeMs: 100,
      frameCount: 0,
      apiRequestCount: 3,
      interactionCount: 2,
      retryCount: 0,
      failureReason: "blocked",
      automationCost: 1.25,
    });
    expect(row.runId).toBeTruthy();
    const listed = listAttackRuns();
    expect(listed[0]?.attackName).toBe("direct_api_attack");
    expect(JSON.stringify(listed)).not.toMatch(/signing|secret|token/i);
  });
});
