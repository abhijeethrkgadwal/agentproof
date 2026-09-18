import { describe, expect, it } from "vitest";
import {
  signChallengeToken,
  verifyChallengeToken,
  type ChallengeTokenPayload,
} from "@/lib/security/signing";
import { isExpired, computeExpiresAt, ageMs } from "@/lib/security/expiry";
import { InMemoryChallengeStore } from "@/lib/storage/challengeStore";
import { generateTemporalChallenge } from "@/lib/challenge/generator";
import { assertNotConsumed } from "@/lib/security/replay";

const SECRET = "vitest-agentproof-signing-secret-do-not-use-in-prod";

function samplePayload(
  overrides: Partial<ChallengeTokenPayload> = {},
): ChallengeTokenPayload {
  return {
    challengeId: "11111111-1111-4111-8111-111111111111",
    sessionId: "22222222-2222-4222-8222-222222222222",
    nonce: "abc123",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    difficulty: 1,
    challengeType: "temporal",
    ...overrides,
  };
}

describe("signature generation and verification", () => {
  it("signs and verifies a valid token", () => {
    const payload = samplePayload();
    const token = signChallengeToken(payload, SECRET);
    const result = verifyChallengeToken(token, SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.challengeId).toBe(payload.challengeId);
      expect(result.payload.nonce).toBe(payload.nonce);
    }
  });

  it("rejects tampered tokens", () => {
    const token = signChallengeToken(samplePayload(), SECRET);
    const [body] = token.split(".");
    const tampered = `${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(verifyChallengeToken(tampered, SECRET)).toEqual({
      ok: false,
      error: "invalid_signature",
    });
  });

  it("rejects malformed tokens", () => {
    expect(verifyChallengeToken("", SECRET).ok).toBe(false);
    expect(verifyChallengeToken("not-a-token", SECRET)).toEqual({
      ok: false,
      error: "malformed_token",
    });
    expect(verifyChallengeToken("a.b.c", SECRET)).toEqual({
      ok: false,
      error: "malformed_token",
    });
  });

  it("rejects tokens signed with a different secret", () => {
    const token = signChallengeToken(samplePayload(), SECRET);
    expect(verifyChallengeToken(token, "other-secret").ok).toBe(false);
  });
});

describe("expiration", () => {
  it("detects expired timestamps", () => {
    const past = new Date(Date.now() - 1000);
    expect(isExpired(past)).toBe(true);
    expect(isExpired(computeExpiresAt(60_000))).toBe(false);
    expect(ageMs(new Date(Date.now() - 5000))).toBeGreaterThanOrEqual(4900);
  });
});

describe("replay prevention", () => {
  it("marks challenges consumed and rejects replay", () => {
    const store = new InMemoryChallengeStore();
    const challenge = generateTemporalChallenge({ difficulty: 1 });
    store.createChallenge(challenge);
    expect(assertNotConsumed(store, challenge.challengeId)).toEqual({
      ok: true,
    });
    expect(store.consumeChallenge(challenge.challengeId)).toBe(true);
    expect(store.isConsumed(challenge.challengeId)).toBe(true);
    expect(assertNotConsumed(store, challenge.challengeId)).toEqual({
      ok: false,
      error: "replay",
    });
    expect(store.consumeChallenge(challenge.challengeId)).toBe(false);
  });
});
