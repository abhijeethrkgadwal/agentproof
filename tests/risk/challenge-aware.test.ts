import { describe, expect, it } from "vitest";
import { createFeatureSnapshot } from "@/lib/features/snapshot";
import { RuleDecisionEngine } from "@/lib/decision/ruleEngine";
import { calculateRisk } from "@/lib/risk/score";
import { getChallengeRiskProfile } from "@/lib/risk/profiles";

const NATURAL_TYPES = ["drag_avoid", "physical", "dynamic_path"] as const;

function factorCodes(
  factors: Array<{ code: string }> | undefined,
): string[] {
  return (factors ?? []).map((f) => f.code);
}

describe("challenge risk profiles", () => {
  it("keeps temporal stricter than natural", () => {
    const temporal = getChallengeRiskProfile("temporal");
    const natural = getChallengeRiskProfile("drag_avoid");
    expect(temporal.kind).toBe("temporal");
    expect(natural.kind).toBe("natural");
    expect(natural.excessiveInteractionThreshold).toBeGreaterThan(
      temporal.excessiveInteractionThreshold,
    );
    expect(natural.adaptiveTooFastMs).toBeLessThan(temporal.adaptiveTooFastMs);
  });

  it("treats legacy temporal_object_tracking as temporal", () => {
    expect(getChallengeRiskProfile("temporal_object_tracking").kind).toBe(
      "temporal",
    );
  });
});

describe("Phase 10 - legitimate natural pointer-heavy solves", () => {
  const engine = new RuleDecisionEngine();

  it.each(NATURAL_TYPES)(
    "%s: verified fast pointer-heavy solve stays LOW/allow",
    (challengeType) => {
      // ~60Hz samples over ~2.5s plus a bit of jitter - common for drags.
      const result = engine.evaluate(
        createFeatureSnapshot({
          challengeType,
          difficulty: 1,
          completionTimeMs: 2400,
          frameCount: 14,
          apiRequestCount: 16,
          interactionEventCount: 180,
          retryCount: 0,
          challengeAgeMs: 3200,
          verified: true,
          decision: "pending",
        }),
      );
      expect(factorCodes(result.factors)).not.toContain("excessive_interaction");
      expect(factorCodes(result.factors)).not.toContain("too_fast");
      expect(factorCodes(result.factors)).not.toContain("adaptive_too_fast");
      expect(result.classification).toBe("LOW");
      expect(result.nextAction).toBe("allow");
      expect(result.riskScore).toBeLessThan(0.3);
    },
  );

  it("drag_avoid: near min-active verified solve is not adaptive_too_fast", () => {
    const result = engine.evaluate(
      createFeatureSnapshot({
        challengeType: "drag_avoid",
        difficulty: 1,
        completionTimeMs: 1300,
        frameCount: 8,
        apiRequestCount: 10,
        interactionEventCount: 95,
        retryCount: 0,
        challengeAgeMs: 2000,
        verified: true,
        decision: "pending",
      }),
    );
    expect(factorCodes(result.factors)).not.toContain("adaptive_too_fast");
    expect(factorCodes(result.factors)).not.toContain("too_fast");
    expect(result.classification).toBe("LOW");
    expect(result.nextAction).toBe("allow");
  });

  it("calculateRisk: 150 pointer events on physical does not trip excessive", () => {
    const result = calculateRisk({
      challengeType: "physical",
      challengeSolved: true,
      completionTimeMs: 3500,
      failedAttempts: 0,
      retryCount: 0,
      interactionEventCount: 150,
      challengeAgeMs: 4000,
      expectedDurationMs: 8000,
    });
    expect(factorCodes(result.factors)).not.toContain("excessive_interaction");
    expect(result.band).toBe("LOW");
    expect(result.decision).toBe("allow");
  });
});

describe("Phase 10 - anomalous natural behaviour still flagged", () => {
  const engine = new RuleDecisionEngine();

  it("instant verified natural solve is too_fast + adaptive_too_fast", () => {
    const result = engine.evaluate(
      createFeatureSnapshot({
        challengeType: "dynamic_path",
        difficulty: 1,
        completionTimeMs: 200,
        frameCount: 1,
        apiRequestCount: 3,
        interactionEventCount: 2,
        retryCount: 0,
        challengeAgeMs: 300,
        verified: true,
        decision: "pending",
      }),
    );
    expect(factorCodes(result.factors)).toContain("too_fast");
    expect(factorCodes(result.factors)).toContain("adaptive_too_fast");
    expect(result.riskScore).toBeGreaterThanOrEqual(0.3);
    expect(["MEDIUM", "HIGH"]).toContain(result.classification);
  });

  it("verified natural with almost no pointer events is sparse", () => {
    const result = engine.evaluate(
      createFeatureSnapshot({
        challengeType: "drag_avoid",
        difficulty: 1,
        completionTimeMs: 4000,
        frameCount: 20,
        apiRequestCount: 22,
        interactionEventCount: 1,
        retryCount: 0,
        challengeAgeMs: 5000,
        verified: true,
        decision: "pending",
      }),
    );
    expect(factorCodes(result.factors)).toContain("sparse_interaction");
    expect(factorCodes(result.factors)).toContain("adaptive_sparse_interaction");
    expect(result.riskScore).toBeGreaterThanOrEqual(0.3);
  });

  it("pathological pointer flood triggers excessive_interaction", () => {
    const result = calculateRisk({
      challengeType: "physical",
      challengeSolved: true,
      completionTimeMs: 5000,
      failedAttempts: 0,
      retryCount: 0,
      interactionEventCount: 2500,
      challengeAgeMs: 6000,
      expectedDurationMs: 8000,
    });
    expect(factorCodes(result.factors)).toContain("excessive_interaction");
  });

  it("failed natural answer still scores HIGH", () => {
    const result = engine.evaluate(
      createFeatureSnapshot({
        challengeType: "drag_avoid",
        difficulty: 1,
        completionTimeMs: 3000,
        frameCount: 12,
        apiRequestCount: 14,
        interactionEventCount: 120,
        retryCount: 2,
        challengeAgeMs: 4000,
        verified: false,
        decision: "pending",
      }),
    );
    expect(result.classification).toBe("HIGH");
    expect(result.nextAction).toBe("restrict");
  });
});

describe("Phase 10 - temporal behaviour preserved", () => {
  const engine = new RuleDecisionEngine();

  it("normal temporal success remains LOW", () => {
    const result = engine.evaluate(
      createFeatureSnapshot({
        challengeType: "temporal",
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
  });

  it("temporal still flags >40 interaction events as excessive", () => {
    const result = calculateRisk({
      challengeType: "temporal",
      challengeSolved: true,
      completionTimeMs: 5200,
      failedAttempts: 0,
      retryCount: 0,
      interactionEventCount: 55,
      challengeAgeMs: 6000,
      expectedDurationMs: 5000,
    });
    expect(factorCodes(result.factors)).toContain("excessive_interaction");
  });

  it("temporal still flags sub-1.5s completion via adaptive_too_fast", () => {
    const result = engine.evaluate(
      createFeatureSnapshot({
        challengeType: "temporal_object_tracking",
        difficulty: 1,
        completionTimeMs: 900,
        frameCount: 40,
        apiRequestCount: 44,
        interactionEventCount: 6,
        retryCount: 0,
        challengeAgeMs: 1200,
        verified: true,
        decision: "pending",
      }),
    );
    expect(factorCodes(result.factors)).toContain("adaptive_too_fast");
    expect(result.riskScore).toBeGreaterThanOrEqual(0.25);
  });
});
