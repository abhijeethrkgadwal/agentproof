import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as createChallenge } from "@/app/api/challenge/route";
import { POST as startChallenge } from "@/app/api/challenge/start/route";
import { POST as verifyChallenge } from "@/app/api/verify/route";
import { getChallengeStore } from "@/lib/storage/challengeStore";
import { resetRateLimits } from "@/lib/security/rateLimit";
import {
  InMemorySessionStore,
  SESSION_COOKIE,
  setSessionStoreForTests,
} from "@/lib/security/session";
import { listFeatureSnapshots } from "@/lib/features/store";


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

describe("Phase 6 verify extras", () => {
  beforeEach(() => {
    setSessionStoreForTests(new InMemorySessionStore());
    void getChallengeStore().clear();
    resetRateLimits();
  });

  afterEach(() => {
    void getChallengeStore().clear();
    resetRateLimits();
  });

  it("blocks expired challenges", async () => {
    const created = await createChallenge(
      jsonRequest("http://localhost/api/challenge", { difficulty: 1 }),
    );
    const challenge = await created.json();
    const cookie = sidCookie(created);
    await startChallenge(
      jsonRequest(
        "http://localhost/api/challenge/start",
        { challengeId: challenge.challengeId, token: challenge.token },
        cookie,
      ),
    );
    await getChallengeStore().updateChallenge(challenge.challengeId, {
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      startedAt: new Date(Date.now() - 6000).toISOString(),
    });
    const verify = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: challenge.challengeId,
          token: challenge.token,
          selectedObjectId: challenge.scene.objects[0].id,
          telemetry: { completionTimeMs: 5000, interactionEventCount: 3 },
        },
        cookie,
      ),
    );
    expect(verify.status).toBe(410);
    const body = await verify.json();
    expect(body.error).toBe("challenge_expired");
  });

  it("blocks premature verification", async () => {
    const created = await createChallenge(
      jsonRequest("http://localhost/api/challenge", { difficulty: 1 }),
    );
    const challenge = await created.json();
    const cookie = sidCookie(created);
    await startChallenge(
      jsonRequest(
        "http://localhost/api/challenge/start",
        { challengeId: challenge.challengeId, token: challenge.token },
        cookie,
      ),
    );
    const verify = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: challenge.challengeId,
          token: challenge.token,
          selectedObjectId: challenge.scene.objects[0].id,
          telemetry: { completionTimeMs: 10, interactionEventCount: 1 },
        },
        cookie,
      ),
    );
    expect(verify.status).toBe(425);
  });

  it("stores a feature snapshot after verification", async () => {
    const before = listFeatureSnapshots().length;
    const created = await createChallenge(
      jsonRequest("http://localhost/api/challenge", { difficulty: 1 }),
    );
    const challenge = await created.json();
    const cookie = sidCookie(created);
    await startChallenge(
      jsonRequest(
        "http://localhost/api/challenge/start",
        { challengeId: challenge.challengeId, token: challenge.token },
        cookie,
      ),
    );
    await getChallengeStore().updateChallenge(challenge.challengeId, {
      startedAt: new Date(Date.now() - 5000).toISOString(),
    });
    const stored = (await getChallengeStore().getChallenge(challenge.challengeId))!;
    const verify = await verifyChallenge(
      jsonRequest(
        "http://localhost/api/verify",
        {
          challengeId: challenge.challengeId,
          token: challenge.token,
          selectedObjectId: stored.groundTruth.correctObjectId,
          telemetry: { completionTimeMs: 5200, interactionEventCount: 6 },
        },
        cookie,
      ),
    );
    expect(verify.status).toBe(200);
    expect(listFeatureSnapshots().length).toBeGreaterThan(before);
  });
});
