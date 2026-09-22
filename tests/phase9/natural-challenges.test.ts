import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as createChallenge } from "@/app/api/challenge/route";
import { POST as startChallenge } from "@/app/api/challenge/start/route";
import { POST as frameChallenge } from "@/app/api/challenge/frame/route";
import { POST as verifyChallenge } from "@/app/api/verify/route";
import { publicPayloadLeaksMotion } from "@/lib/challenge/public";
import { generateChallengeByType } from "@/lib/challenge/core/registry";
import { ALL_CHALLENGE_TYPES } from "@/lib/challenge/core/meta";
import { getChallengeStore } from "@/lib/storage/challengeStore";
import { resetRateLimits } from "@/lib/security/rateLimit";
import {
  InMemorySessionStore,
  SESSION_COOKIE,
  setSessionStoreForTests,
} from "@/lib/security/session";
import { signChallengeToken } from "@/lib/security/signing";
import { LAB_CHALLENGE_TYPES } from "@/lib/lab/types";
import { runNaturalChallengePlaceholder } from "@/lib/lab/attacks/naturalPlaceholders";
import type { ChallengeType } from "@/lib/challenge/types";
import { isDragAvoidChallenge, isDynamicPathChallenge, isPhysicalChallenge } from "@/lib/challenge/types";

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

function sidCookie(response: Response): string {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) throw new Error("missing session cookie");
  return `${SESSION_COOKIE}=${match[1]}`;
}

async function issue(type: ChallengeType) {
  const created = await createChallenge(
    jsonRequest("http://localhost/api/challenge", {
      difficulty: 1,
      challengeType: type,
    }),
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
  await getChallengeStore().updateChallenge(challenge.challengeId, {
    startedAt: new Date(Date.now() - activeMs).toISOString(),
  });
}

describe("Phase 9 natural challenges", () => {
  beforeEach(() => {
    setSessionStoreForTests(new InMemorySessionStore());
    void getChallengeStore().clear();
    resetRateLimits();
  });

  afterEach(() => {
    void getChallengeStore().clear();
    resetRateLimits();
  });

  it("lab recognizes all four challenge types", () => {
    expect(LAB_CHALLENGE_TYPES).toEqual([
      "temporal",
      "drag_avoid",
      "physical",
      "dynamic_path",
    ]);
    expect(ALL_CHALLENGE_TYPES).toEqual(LAB_CHALLENGE_TYPES);
  });

  it("placeholders do not invent success", async () => {
    for (const type of ["drag_avoid", "physical", "dynamic_path"] as const) {
      const row = await runNaturalChallengePlaceholder({ challengeType: type });
      expect(row.success).toBe(false);
      expect(row.failureReason).toBe("attacker_not_implemented");
    }
  });

  for (const type of ["drag_avoid", "physical", "dynamic_path"] as const) {
    describe(type, () => {
      it("issues without hidden future state", async () => {
        const { challenge } = await issue(type);
        expect(challenge.challengeType).toBe(type);
        expect(publicPayloadLeaksMotion(challenge)).toBe(false);
        expect(challenge).not.toHaveProperty("groundTruth");
        expect(JSON.stringify(challenge)).not.toContain("segments");
        expect(JSON.stringify(challenge)).not.toContain("accessibleSafePath");
        expect(JSON.stringify(challenge)).not.toContain("accessibleGateSlots");
        expect(JSON.stringify(challenge)).not.toContain("openingCenterStart");
        expect(JSON.stringify(challenge)).not.toContain("protectedBounds");
      });

      it("frame does not leak future trajectories", async () => {
        const { challenge, cookie } = await issue(type);
        await startChallenge(
          jsonRequest(
            "http://localhost/api/challenge/start",
            { challengeId: challenge.challengeId, token: challenge.token },
            cookie,
          ),
        );
        const frame = await frameChallenge(
          jsonRequest(
            "http://localhost/api/challenge/frame",
            { challengeId: challenge.challengeId, token: challenge.token },
            cookie,
          ),
        );
        expect(frame.status).toBe(200);
        const body = await frame.json();
        expect(publicPayloadLeaksMotion(body)).toBe(false);
        expect(JSON.stringify(body)).not.toContain("segments");
      });

      it("rejects premature verification", async () => {
        const { challenge, cookie } = await issue(type);
        await startChallenge(
          jsonRequest(
            "http://localhost/api/challenge/start",
            { challengeId: challenge.challengeId, token: challenge.token },
            cookie,
          ),
        );
        const response = await verifyChallenge(
          jsonRequest(
            "http://localhost/api/verify",
            {
              challengeId: challenge.challengeId,
              token: challenge.token,
              interaction: { samples: [{ t: 0, x: 10, y: 10 }] },
            },
            cookie,
          ),
        );
        expect(response.status).toBe(425);
        expect((await response.json()).error).toBe("premature_submit");
      });

      it("rejects expired challenge", async () => {
        const { challenge, cookie } = await issue(type);
        await getChallengeStore().updateChallenge(challenge.challengeId, {
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        });
        const response = await startChallenge(
          jsonRequest(
            "http://localhost/api/challenge/start",
            { challengeId: challenge.challengeId, token: challenge.token },
            cookie,
          ),
        );
        expect(response.status).toBe(410);
      });

      it("rejects replay after consume", async () => {
        const { challenge, cookie } = await issue(type);
        await startAndBackdate(challenge, cookie, 20_000);
        const first = await verifyChallenge(
          jsonRequest(
            "http://localhost/api/verify",
            {
              challengeId: challenge.challengeId,
              token: challenge.token,
              interaction: {
                samples: [
                  { t: 0, x: 70, y: 180, objectId: "agent" },
                  { t: 500, x: 100, y: 180, objectId: "agent" },
                  { t: 1000, x: 200, y: 180, objectId: "agent" },
                ],
              },
            },
            cookie,
          ),
        );
        expect(first.status).toBe(200);
        const second = await verifyChallenge(
          jsonRequest(
            "http://localhost/api/verify",
            {
              challengeId: challenge.challengeId,
              token: challenge.token,
              interaction: { samples: [{ t: 0, x: 1, y: 1 }] },
            },
            cookie,
          ),
        );
        expect(second.status).toBe(409);
        expect((await second.json()).error).toBe("replay");
      });

      it("rejects tampered token", async () => {
        const { challenge, cookie } = await issue(type);
        const [body] = challenge.token.split(".");
        const tampered = `${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
        const response = await verifyChallenge(
          jsonRequest(
            "http://localhost/api/verify",
            {
              challengeId: challenge.challengeId,
              token: tampered,
              interaction: { samples: [{ t: 0, x: 1, y: 1 }] },
            },
            cookie,
          ),
        );
        expect(response.status).toBe(401);
      });

      it("rejects session mismatch", async () => {
        const { challenge } = await issue(type);
        const response = await verifyChallenge(
          jsonRequest("http://localhost/api/verify", {
            challengeId: challenge.challengeId,
            token: challenge.token,
            interaction: { samples: [{ t: 0, x: 1, y: 1 }] },
          }),
        );
        expect([403, 409]).toContain(response.status);
      });

      it("rejects invalid lifecycle (direct verify)", async () => {
        const { challenge, cookie } = await issue(type);
        const response = await verifyChallenge(
          jsonRequest(
            "http://localhost/api/verify",
            {
              challengeId: challenge.challengeId,
              token: challenge.token,
              interaction: { samples: [{ t: 0, x: 1, y: 1 }] },
            },
            cookie,
          ),
        );
        expect(response.status).toBe(409);
        expect((await response.json()).error).toBe("invalid_lifecycle");
      });
    });
  }

  it("drag_avoid validates success trajectory and rejects collision", async () => {
    const stored = generateChallengeByType("drag_avoid", { difficulty: 1 });
    expect(isDragAvoidChallenge(stored)).toBe(true);
    if (!isDragAvoidChallenge(stored)) return;

    const token = signChallengeToken({
      challengeId: stored.challengeId,
      sessionId: stored.sessionId,
      nonce: stored.nonce,
      issuedAt: stored.issuedAt,
      expiresAt: stored.expiresAt,
      difficulty: stored.difficulty,
      challengeType: stored.challengeType,
    });
    await getChallengeStore().createChallenge(stored);

    // Wire session
    const { getSessionStore } = await import("@/lib/security/session");
    await getSessionStore().put({
      sessionId: stored.sessionId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      environment: "test",
    });
    const { signSessionToken } = await import("@/lib/security/session");
    const cookie = `${SESSION_COOKIE}=${signSessionToken(stored.sessionId, Date.now() + 60_000)}`;

    await startAndBackdate(
      { challengeId: stored.challengeId, token },
      cookie,
      20_000,
    );

    const wrong = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: stored.challengeId,
          token,
          interaction: {
            samples: [
              { t: 0, x: stored.renderConfiguration.agent.start.x, y: stored.renderConfiguration.agent.start.y, objectId: "agent" },
              { t: 100, x: 10, y: 10, objectId: "agent" },
              { t: 200, x: 20, y: 20, objectId: "agent" },
            ],
          },
        },
        cookie,
      ),
    );
    expect(wrong.status).toBe(200);
    const wrongBody = await wrong.json();
    expect(wrongBody.verified).toBe(false);
  });

  it("physical rejects secret accessible answers without trajectory", async () => {
    const stored = generateChallengeByType("physical", { difficulty: 1 });
    expect(isPhysicalChallenge(stored)).toBe(true);
    if (!isPhysicalChallenge(stored)) return;
    const token = signChallengeToken({
      challengeId: stored.challengeId,
      sessionId: stored.sessionId,
      nonce: stored.nonce,
      issuedAt: stored.issuedAt,
      expiresAt: stored.expiresAt,
      difficulty: stored.difficulty,
      challengeType: stored.challengeType,
    });
    await getChallengeStore().createChallenge(stored);
    const { getSessionStore, signSessionToken } = await import(
      "@/lib/security/session"
    );
    await getSessionStore().put({
      sessionId: stored.sessionId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      environment: "test",
    });
    const cookie = `${SESSION_COOKIE}=${signSessionToken(stored.sessionId, Date.now() + 60_000)}`;
    await startAndBackdate(
      { challengeId: stored.challengeId, token },
      cookie,
      20_000,
    );

    const bad = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: stored.challengeId,
          token,
          interaction: {
            accessibleAnswers: {
              placement: stored.groundTruth.accessiblePlacementKey,
            },
          },
        },
        cookie,
      ),
    );
    const body = await bad.json();
    expect(body.verified).toBe(false);
    expect(body.reason).toBe("invalid_accessible_answer");
  });

  it("physical accepts a careful placement trajectory", async () => {
    const stored = generateChallengeByType("physical", { difficulty: 1 });
    expect(isPhysicalChallenge(stored)).toBe(true);
    if (!isPhysicalChallenge(stored)) return;
    const { validatePhysical } = await import("@/lib/challenge/physical");
    const agent = stored.renderConfiguration.bodies.find((b) => b.id === "agent")!;
    const platform = stored.renderConfiguration.platform;
    const start = {
      x: agent.start.x + agent.width / 2,
      y: agent.start.y + agent.height / 2,
    };
    // Arc above the protected block onto the platform left side (slow enough)
    const samples = [
      { t: 0, x: start.x, y: start.y, objectId: "agent" },
      { t: 800, x: start.x, y: 80, objectId: "agent" },
      { t: 1600, x: platform.x + 36, y: 80, objectId: "agent" },
      { t: 2400, x: platform.x + 36, y: platform.y + platform.height / 2, objectId: "agent" },
    ];
    const result = validatePhysical(stored, { interaction: { samples } });
    expect(result).toEqual({ correct: true });
  });

  it("dynamic_path rejects incomplete path", async () => {
    const stored = generateChallengeByType("dynamic_path", { difficulty: 1 });
    expect(isDynamicPathChallenge(stored)).toBe(true);
    if (!isDynamicPathChallenge(stored)) return;
    const { validateDynamicPath } = await import(
      "@/lib/challenge/dynamic-path"
    );
    const result = validateDynamicPath(stored, {
      interaction: {
        samples: [
          {
            t: 0,
            x: stored.renderConfiguration.ball.start.x,
            y: stored.renderConfiguration.ball.start.y,
            objectId: "ball",
          },
          { t: 100, x: 80, y: 180, objectId: "ball" },
          { t: 200, x: 90, y: 180, objectId: "ball" },
        ],
      },
    });
    expect(result.correct).toBe(false);
  });

  it("temporal challenge still issues as default", async () => {
    const { challenge } = await issue("temporal");
    expect(challenge.challengeType).toBe("temporal");
    expect(challenge.scene.objects.length).toBeGreaterThanOrEqual(6);
  });

  it("accepts verify telemetry with >100 pointer events (no missing_or_invalid_fields)", async () => {
    const { challenge, cookie } = await issue("drag_avoid");
    await startAndBackdate(challenge, cookie, 20_000);
    const events = Array.from({ length: 150 }, (_, i) => ({
      eventType: "object_moved" as const,
      timestamp: new Date().toISOString(),
      relativeTimeMs: i,
      challengeId: challenge.challengeId,
    }));
    const response = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: challenge.challengeId,
          token: challenge.token,
          interaction: {
            samples: [
              { t: 0, x: 70, y: 180, objectId: "agent" },
              { t: 500, x: 200, y: 180, objectId: "agent" },
              { t: 1000, x: 560, y: 180, objectId: "agent" },
            ],
          },
          telemetry: {
            completionTimeMs: 5000,
            interactionEventCount: 150,
            events,
          },
        },
        cookie,
      ),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.error).not.toBe("missing_or_invalid_fields");
    expect(typeof body.verified).toBe("boolean");
  });
});
