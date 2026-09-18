import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as createChallenge } from "@/app/api/challenge/route";
import { POST as verifyChallenge } from "@/app/api/verify/route";
import { GET as health } from "@/app/api/health/route";
import { getChallengeStore } from "@/lib/storage/challengeStore";
import { resetRateLimits } from "@/lib/security/rateLimit";
import { signChallengeToken } from "@/lib/security/signing";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API routes", () => {
  beforeEach(() => {
    getChallengeStore().clear();
    resetRateLimits();
  });

  afterEach(() => {
    getChallengeStore().clear();
    resetRateLimits();
  });

  it("health returns ok", async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "agentproof",
    });
  });

  it("creates a challenge without exposing groundTruth", async () => {
    const response = await createChallenge(
      jsonRequest("http://localhost/api/challenge", { difficulty: 1 }),
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.challengeId).toBeTruthy();
    expect(data.token).toContain(".");
    expect(data.renderConfiguration.objects.length).toBeGreaterThanOrEqual(6);
    expect(data).not.toHaveProperty("groundTruth");
    expect(JSON.stringify(data)).not.toContain("correctObjectId");
  });

  it("verifies a correct answer and rejects replay", async () => {
    const created = await createChallenge(
      jsonRequest("http://localhost/api/challenge", { difficulty: 1 }),
    );
    const challenge = await created.json();
    const stored = getChallengeStore().getChallenge(challenge.challengeId)!;
    const correct = stored.groundTruth.correctObjectId;

    const verified = await verifyChallenge(
      jsonRequest("http://localhost/api/verify", {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: correct,
        telemetry: {
          completionTimeMs: 5500,
          interactionEventCount: 5,
          retryCount: 0,
          events: [],
        },
      }),
    );
    expect(verified.status).toBe(200);
    const result = await verified.json();
    expect(result.verified).toBe(true);
    expect(result.decision).toBe("allow");
    expect(result.riskScore).toBeLessThan(0.3);

    const replay = await verifyChallenge(
      jsonRequest("http://localhost/api/verify", {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: correct,
        telemetry: {},
      }),
    );
    expect(replay.status).toBe(409);
    expect((await replay.json()).error).toBe("replay");
  });

  it("rejects incorrect answers", async () => {
    const created = await createChallenge(
      jsonRequest("http://localhost/api/challenge", { difficulty: 1 }),
    );
    const challenge = await created.json();
    const stored = getChallengeStore().getChallenge(challenge.challengeId)!;
    const wrong = stored.renderConfiguration.objects.find(
      (o) => o.id !== stored.groundTruth.correctObjectId,
    )!.id;

    const response = await verifyChallenge(
      jsonRequest("http://localhost/api/verify", {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: wrong,
        telemetry: { completionTimeMs: 4000, interactionEventCount: 4 },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.verified).toBe(false);
    expect(body.reason).toBe("incorrect_answer");
  });

  it("rejects invalid signatures and malformed tokens", async () => {
    const created = await createChallenge(
      jsonRequest("http://localhost/api/challenge", { difficulty: 1 }),
    );
    const challenge = await created.json();
    const stored = getChallengeStore().getChallenge(challenge.challengeId)!;

    const badSig = await verifyChallenge(
      jsonRequest("http://localhost/api/verify", {
        challengeId: challenge.challengeId,
        token: challenge.token.slice(0, -4) + "xxxx",
        selectedObjectId: stored.groundTruth.correctObjectId,
      }),
    );
    expect(badSig.status).toBe(401);

    const malformed = await verifyChallenge(
      jsonRequest("http://localhost/api/verify", {
        challengeId: challenge.challengeId,
        token: "broken",
        selectedObjectId: stored.groundTruth.correctObjectId,
      }),
    );
    expect(malformed.status).toBe(401);
    expect((await malformed.json()).error).toBe("malformed_token");
  });

  it("rejects challenge id mismatch", async () => {
    const created = await createChallenge(
      jsonRequest("http://localhost/api/challenge", { difficulty: 1 }),
    );
    const challenge = await created.json();
    const response = await verifyChallenge(
      jsonRequest("http://localhost/api/verify", {
        challengeId: "33333333-3333-4333-8333-333333333333",
        token: challenge.token,
        selectedObjectId: "object_1",
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("challenge_id_mismatch");
  });

  it("rejects expired challenges", async () => {
    const created = await createChallenge(
      jsonRequest("http://localhost/api/challenge", { difficulty: 1 }),
    );
    const challenge = await created.json();
    const stored = getChallengeStore().getChallenge(challenge.challengeId)!;

    // Force expiry in store + re-sign token with past expiry
    stored.expiresAt = new Date(Date.now() - 1000).toISOString();
    getChallengeStore().deleteChallenge(challenge.challengeId);
    getChallengeStore().createChallenge({ ...stored, consumed: false });

    const expiredToken = signChallengeToken({
      challengeId: stored.challengeId,
      sessionId: stored.sessionId,
      nonce: stored.nonce,
      issuedAt: stored.issuedAt,
      expiresAt: stored.expiresAt,
      difficulty: stored.difficulty,
      challengeType: stored.challengeType,
    });

    const response = await verifyChallenge(
      jsonRequest("http://localhost/api/verify", {
        challengeId: stored.challengeId,
        token: expiredToken,
        selectedObjectId: stored.groundTruth.correctObjectId,
      }),
    );
    expect(response.status).toBe(410);
    expect((await response.json()).error).toBe("challenge_expired");
  });

  it("rejects missing fields", async () => {
    const response = await verifyChallenge(
      jsonRequest("http://localhost/api/verify", { challengeId: "x" }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("missing_or_invalid_fields");
  });

  it("rejects excessive requests", async () => {
    process.env.AGENTPROOF_RATE_LIMIT_MAX = "2";
    process.env.AGENTPROOF_RATE_LIMIT_WINDOW_MS = "60000";
    resetRateLimits();

    const req = () =>
      createChallenge(
        jsonRequest("http://localhost/api/challenge", { difficulty: 1 }),
      );

    expect((await req()).status).toBe(200);
    expect((await req()).status).toBe(200);
    const limited = await req();
    expect(limited.status).toBe(429);
    expect((await limited.json()).error).toBe("rate_limited");

    process.env.AGENTPROOF_RATE_LIMIT_MAX = "10000";
    resetRateLimits();
  });
});
