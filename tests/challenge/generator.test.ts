import { describe, expect, it } from "vitest";
import { generateTemporalChallenge } from "@/lib/challenge/generator";
import { getDifficultyProfile } from "@/lib/challenge/difficulty";
import { validateSelectedObject } from "@/lib/challenge/validator";
import { generateNonce } from "@/lib/security/nonce";

describe("challenge generation", () => {
  it("creates temporal challenges with server-side ground truth", () => {
    const challenge = generateTemporalChallenge({ difficulty: 1 });
    expect(challenge.challengeType).toBe("temporal");
    expect(challenge.challengeId).toBeTruthy();
    expect(challenge.nonce).toMatch(/^[a-f0-9]+$/);
    expect(challenge.groundTruth.correctObjectId).toMatch(/^object_/);
    expect(challenge.renderConfiguration.objects.length).toBeGreaterThanOrEqual(
      6,
    );
    expect(
      challenge.groundTruth.directionChangeCounts[
        challenge.groundTruth.correctObjectId
      ],
    ).toBe(challenge.groundTruth.requiredDirectionChanges);
  });

  it("ensures exactly one object matches the required direction changes", () => {
    for (let i = 0; i < 15; i += 1) {
      const challenge = generateTemporalChallenge({
        difficulty: 2,
        requiredDirectionChanges: 2,
      });
      const required = challenge.groundTruth.requiredDirectionChanges;
      const matches = Object.entries(
        challenge.groundTruth.directionChangeCounts,
      ).filter(([, count]) => count === required);
      expect(matches).toHaveLength(1);
      expect(matches[0]![0]).toBe(challenge.groundTruth.correctObjectId);
    }
  });

  it("scales object count with difficulty profiles", () => {
    const d1 = getDifficultyProfile(1);
    const d5 = getDifficultyProfile(5);
    expect(d5.objectCount.min).toBeGreaterThanOrEqual(d1.objectCount.min);
    expect(d5.durationMs).toBeLessThan(d1.durationMs);
  });
});

describe("nonce uniqueness", () => {
  it("generates unique nonces", () => {
    const set = new Set(Array.from({ length: 200 }, () => generateNonce()));
    expect(set.size).toBe(200);
  });
});

describe("ground-truth validation", () => {
  it("accepts the correct object and rejects others", () => {
    const challenge = generateTemporalChallenge({ difficulty: 1 });
    const correct = challenge.groundTruth.correctObjectId;
    expect(validateSelectedObject(challenge, correct)).toEqual({
      correct: true,
    });
    const other = challenge.renderConfiguration.objects.find(
      (o) => o.id !== correct,
    )!;
    expect(validateSelectedObject(challenge, other.id)).toEqual({
      correct: false,
      reason: "incorrect_answer",
    });
    expect(validateSelectedObject(challenge, "object_missing")).toEqual({
      correct: false,
      reason: "unknown_object",
    });
  });
});
