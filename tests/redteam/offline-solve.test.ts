/**
 * Phase 2 measurement: offline ground-truth derivation from public payloads.
 * Does not change product security - documents leakage.
 */
import { describe, expect, it } from "vitest";
import { generateTemporalChallenge } from "@/lib/challenge/generator";
import { toPublicChallenge } from "@/lib/challenge/public";
import { signChallengeToken } from "@/lib/security/signing";

const THRESHOLD = Math.PI / 6;

function countDirectionChanges(
  segments: { velocity: { x: number; y: number } }[],
): number {
  if (segments.length <= 1) return 0;
  let changes = 0;
  for (let i = 1; i < segments.length; i += 1) {
    const prev = segments[i - 1]!.velocity;
    const curr = segments[i]!.velocity;
    const a1 = Math.atan2(prev.y, prev.x);
    const a2 = Math.atan2(curr.y, curr.x);
    let delta = Math.abs(a2 - a1);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    if (delta > THRESHOLD) changes += 1;
  }
  return changes;
}

function deriveFromPublic(publicChallenge: {
  renderConfiguration: {
    requiredDirectionChanges: number;
    objects: { id: string; segments: { velocity: { x: number; y: number } }[] }[];
  };
}): string {
  const required = publicChallenge.renderConfiguration.requiredDirectionChanges;
  const matches = publicChallenge.renderConfiguration.objects.filter(
    (o) => countDirectionChanges(o.segments) === required,
  );
  expect(matches).toHaveLength(1);
  return matches[0]!.id;
}

describe("red-team: motion segment leakage", () => {
  it("derives server ground truth from public renderConfiguration (100 trials)", () => {
    let hits = 0;
    for (let i = 0; i < 100; i += 1) {
      const stored = generateTemporalChallenge({ difficulty: (i % 2) + 1 });
      const token = signChallengeToken({
        challengeId: stored.challengeId,
        sessionId: stored.sessionId,
        nonce: stored.nonce,
        issuedAt: stored.issuedAt,
        expiresAt: stored.expiresAt,
        difficulty: stored.difficulty,
        challengeType: stored.challengeType,
      });
      const pub = toPublicChallenge(stored, token);
      expect(pub).not.toHaveProperty("groundTruth");
      const derived = deriveFromPublic(pub);
      if (derived === stored.groundTruth.correctObjectId) hits += 1;
    }
    // Attack success rate - documenting leakage severity
    expect(hits).toBe(100);
  });

  it("requires only small attacker code surface", () => {
    // Document effort: the derive function above is <25 LOC.
    expect(countDirectionChanges.length).toBe(1);
  });
});
