import { describe, expect, it } from "vitest";
import { generateTemporalChallenge } from "@/lib/challenge/generator";
import {
  publicPayloadLeaksMotion,
  toPublicChallenge,
} from "@/lib/challenge/public";
import { signChallengeToken } from "@/lib/security/signing";

describe("Phase 3 public payload", () => {
  it("never includes segments or ground truth in issued DTO", () => {
    for (let i = 0; i < 20; i += 1) {
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
      expect(publicPayloadLeaksMotion(pub)).toBe(false);
      expect(pub.lifecycle).toBe("issued");
      expect(pub.scene.objects[0]).not.toHaveProperty("segments");
    }
  });
});
