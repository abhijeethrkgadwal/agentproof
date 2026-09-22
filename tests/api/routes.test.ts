import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as createChallenge } from "@/app/api/challenge/route";
import { POST as startChallenge } from "@/app/api/challenge/start/route";
import { POST as frameChallenge } from "@/app/api/challenge/frame/route";
import { POST as verifyChallenge } from "@/app/api/verify/route";
import { GET as health } from "@/app/api/health/route";
import { publicPayloadLeaksMotion } from "@/lib/challenge/public";
import { getChallengeStore } from "@/lib/storage/challengeStore";
import { resetRateLimits } from "@/lib/security/rateLimit";
import { setSessionStoreForTests, InMemorySessionStore } from "@/lib/security/session";
import { SESSION_COOKIE } from "@/lib/security/session";
import { signChallengeToken } from "@/lib/security/signing";
import { isTemporalChallenge } from "@/lib/challenge/types";


function jsonRequest(url: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie) headers.cookie = cookie;
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}


async function temporalStored(challengeId: string) {
  const stored = await getChallengeStore().getChallenge(challengeId);
  if (!stored || !isTemporalChallenge(stored)) {
    throw new Error("expected_temporal_challenge");
  }
  return stored;
}

function sidCookie(response: Response): string {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) throw new Error("missing session cookie");
  return `${SESSION_COOKIE}=${match[1]}`;
}

async function issue() {
  const created = await createChallenge(
    jsonRequest("http://localhost/api/challenge", { difficulty: 1 }),
  );
  const challenge = await created.json();
  const cookie = sidCookie(created);
  return { created, challenge, cookie };
}

async function startAndBackdate(
  challenge: { challengeId: string; token: string },
  cookie: string,
  activeMs: number,
) {
  const started = await startChallenge(
    jsonRequest(
      "http://localhost/api/challenge/start",
      { challengeId: challenge.challengeId, token: challenge.token },
      cookie,
    ),
  );
  expect(started.status).toBe(200);
  const startedAt = new Date(Date.now() - activeMs).toISOString();
  await getChallengeStore().updateChallenge(challenge.challengeId, { startedAt });
  return started;
}

describe("API routes (Phase 3 protocol)", () => {
  beforeEach(() => {
    setSessionStoreForTests(new InMemorySessionStore());
    void getChallengeStore().clear();
    resetRateLimits();
  });

  afterEach(() => {
    void getChallengeStore().clear();
    resetRateLimits();
  });

  it("health returns ok", async () => {
    const response = await health();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      service: "agentproof",
    });
    expect(body.label).toContain("not production security");
    expect(body.storage).toBeDefined();
  });

  it("rejects invalid API keys on challenge issue", async () => {
    const response = await createChallenge(
      new Request("http://localhost/api/challenge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AgentProof-Key": "ap_test_invalidkeyinvalidkeyinvalid12",
        },
        body: JSON.stringify({ difficulty: 1 }),
      }),
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("invalid_api_key");
  });

  it("requires API key for live environment", async () => {
    const response = await createChallenge(
      new Request("http://localhost/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: 1, environment: "live" }),
      }),
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("api_key_required_for_live");
  });

  it("issues a challenge without motion leakage", async () => {
    const { challenge } = await issue();
    expect(challenge.challengeId).toBeTruthy();
    expect(challenge.lifecycle).toBe("issued");
    expect(challenge.scene.objects.length).toBeGreaterThanOrEqual(6);
    expect(challenge).not.toHaveProperty("groundTruth");
    expect(challenge).not.toHaveProperty("renderConfiguration");
    expect(publicPayloadLeaksMotion(challenge)).toBe(false);
    for (const object of challenge.scene.objects) {
      expect(object).not.toHaveProperty("segments");
      expect(object).not.toHaveProperty("start");
    }
  });

  it("rejects verify before start (invalid lifecycle)", async () => {
    const { challenge, cookie } = await issue();
    const stored = await temporalStored(challenge.challengeId);
    const response = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: challenge.challengeId,
          token: challenge.token,
          selectedObjectId: stored.groundTruth.correctObjectId,
          telemetry: {},
        },
        cookie,
      ),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("invalid_lifecycle");
  });

  it("rejects verify without session cookie", async () => {
    const { challenge } = await issue();
    const response = await verifyChallenge(
      jsonRequest("http://localhost/api/verify", {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: "object_1",
      }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("session_missing");
  });

  it("rejects frame before start", async () => {
    const { challenge, cookie } = await issue();
    const response = await frameChallenge(
      jsonRequest(
        "http://localhost/api/challenge/frame",
        { challengeId: challenge.challengeId, token: challenge.token },
        cookie,
      ),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("invalid_lifecycle");
  });

  it("verifies a correct answer after active window and rejects replay", async () => {
    const { challenge, cookie } = await issue();
    const stored = await temporalStored(challenge.challengeId);
    await startAndBackdate(
      challenge,
      cookie,
      stored.renderConfiguration.durationMs,
    );

    // Simulate progressive observation
    for (let i = 0; i < 5; i += 1) {
      await frameChallenge(
        jsonRequest(
          "http://localhost/api/challenge/frame",
          { challengeId: challenge.challengeId, token: challenge.token },
          cookie,
        ),
      );
    }

    const correct = stored.groundTruth.correctObjectId;
    const verified = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: challenge.challengeId,
          token: challenge.token,
          selectedObjectId: correct,
          telemetry: {
            completionTimeMs: 5500,
            interactionEventCount: 5,
            retryCount: 0,
            events: [],
          },
        },
        cookie,
      ),
    );
    expect(verified.status).toBe(200);
    const result = await verified.json();
    expect(result.verified).toBe(true);
    expect(result.decision).toBe("allow");
    expect(result.riskScore).toBeLessThan(0.3);

    const replay = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: challenge.challengeId,
          token: challenge.token,
          selectedObjectId: correct,
          telemetry: {},
        },
        cookie,
      ),
    );
    expect(replay.status).toBe(409);
    expect((await replay.json()).error).toBe("replay");
  });

  it("rejects incorrect answers", async () => {
    const { challenge, cookie } = await issue();
    const stored = await temporalStored(challenge.challengeId);
    await startAndBackdate(
      challenge,
      cookie,
      stored.renderConfiguration.durationMs,
    );
    const wrong = stored.renderConfiguration.objects.find(
      (o) => o.id !== stored.groundTruth.correctObjectId,
    )!.id;

    const response = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: challenge.challengeId,
          token: challenge.token,
          selectedObjectId: wrong,
          telemetry: { completionTimeMs: 4000, interactionEventCount: 4 },
        },
        cookie,
      ),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.verified).toBe(false);
    expect(body.reason).toBe("incorrect_answer");
  });

  it("rejects invalid signatures and malformed tokens", async () => {
    const { challenge, cookie } = await issue();
    const stored = await temporalStored(challenge.challengeId);
    await startAndBackdate(
      challenge,
      cookie,
      stored.renderConfiguration.durationMs,
    );

    const badSig = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: challenge.challengeId,
          token: challenge.token.slice(0, -4) + "xxxx",
          selectedObjectId: stored.groundTruth.correctObjectId,
        },
        cookie,
      ),
    );
    expect(badSig.status).toBe(401);

    const malformed = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: challenge.challengeId,
          token: "broken",
          selectedObjectId: stored.groundTruth.correctObjectId,
        },
        cookie,
      ),
    );
    expect(malformed.status).toBe(401);
    expect((await malformed.json()).error).toBe("malformed_token");
  });

  it("rejects challenge id mismatch", async () => {
    const { challenge, cookie } = await issue();
    const response = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: "33333333-3333-4333-8333-333333333333",
          token: challenge.token,
          selectedObjectId: "object_1",
        },
        cookie,
      ),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("challenge_id_mismatch");
  });

  it("rejects expired challenges", async () => {
    const { challenge, cookie } = await issue();
    const stored = await temporalStored(challenge.challengeId);
    stored.expiresAt = new Date(Date.now() - 1000).toISOString();
    getChallengeStore().deleteChallenge(challenge.challengeId);
    getChallengeStore().createChallenge({
      ...stored,
      consumed: false,
      lifecycle: "issued",
    });

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
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: stored.challengeId,
          token: expiredToken,
          selectedObjectId: stored.groundTruth.correctObjectId,
        },
        cookie,
      ),
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

  it("rejects premature submit before min active window", async () => {
    const { challenge, cookie } = await issue();
    const stored = await temporalStored(challenge.challengeId);
    await startChallenge(
      jsonRequest(
        "http://localhost/api/challenge/start",
        { challengeId: challenge.challengeId, token: challenge.token },
        cookie,
      ),
    );
    // startedAt is now — too early
    const response = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: challenge.challengeId,
          token: challenge.token,
          selectedObjectId: stored.groundTruth.correctObjectId,
          telemetry: { completionTimeMs: 10, interactionEventCount: 1 },
        },
        cookie,
      ),
    );
    expect(response.status).toBe(425);
    expect((await response.json()).error).toBe("premature_submit");
  });
});
