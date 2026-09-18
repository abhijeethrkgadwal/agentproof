import { describe, expect, it } from "vitest";
import { calculateRisk } from "@/lib/risk/score";
import { bandForScore, decisionForBand } from "@/lib/risk/types";

describe("risk calculation", () => {
  it("scores a normal successful interaction as LOW / allow", () => {
    const result = calculateRisk({
      challengeSolved: true,
      completionTimeMs: 5200,
      failedAttempts: 0,
      retryCount: 0,
      interactionEventCount: 6,
      challengeAgeMs: 6000,
      expectedDurationMs: 5000,
    });
    expect(result.band).toBe("LOW");
    expect(result.decision).toBe("allow");
    expect(result.riskScore).toBeLessThan(0.3);
  });

  it("scores incorrect answers as HIGH / restrict", () => {
    const result = calculateRisk({
      challengeSolved: false,
      completionTimeMs: 1000,
      failedAttempts: 2,
      retryCount: 1,
      interactionEventCount: 2,
      challengeAgeMs: 2000,
      expectedDurationMs: 5000,
    });
    expect(result.riskScore).toBeGreaterThanOrEqual(0.7);
    expect(result.decision).toBe("restrict");
  });

  it("raises risk for suspiciously fast completion", () => {
    const result = calculateRisk({
      challengeSolved: true,
      completionTimeMs: 200,
      failedAttempts: 0,
      retryCount: 0,
      interactionEventCount: 1,
      challengeAgeMs: 300,
      expectedDurationMs: 5000,
    });
    expect(result.riskScore).toBeGreaterThanOrEqual(0.3);
  });
});

describe("decision thresholds", () => {
  it("maps bands to decisions", () => {
    expect(bandForScore(0.12)).toBe("LOW");
    expect(bandForScore(0.45)).toBe("MEDIUM");
    expect(bandForScore(0.9)).toBe("HIGH");
    expect(decisionForBand("LOW")).toBe("allow");
    expect(decisionForBand("MEDIUM")).toBe("step_up");
    expect(decisionForBand("HIGH")).toBe("restrict");
  });
});
