import { describe, expect, it, beforeEach } from "vitest";
import {
  InMemorySessionStore,
  issueSignedSession,
  resolveRequestSession,
  setSessionStoreForTests,
  signSessionToken,
  verifySessionToken,
  SESSION_COOKIE,
} from "@/lib/security/session";
import { createApiKey, createProject, verifyApiKey } from "@/lib/developers/keys";
import { RuleDecisionEngine } from "@/lib/decision/ruleEngine";
import { createFeatureSnapshot } from "@/lib/features/snapshot";
import { computeAutomationCost } from "@/lib/lab/types";

describe("Phase 7 signed sessions", () => {
  beforeEach(() => {
    setSessionStoreForTests(new InMemorySessionStore());
  });

  it("issues and verifies a signed session token", async () => {
    const issued = await issueSignedSession({ environment: "test" });
    const verified = verifySessionToken(issued.cookieValue);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.sessionId).toBe(issued.sessionId);
    }
  });

  it("rejects tampered session cookies", async () => {
    const issued = await issueSignedSession();
    const tampered = `${issued.cookieValue.slice(0, -4)}XXXX`;
    const verified = verifySessionToken(tampered);
    expect(verified.ok).toBe(false);
  });

  it("resolves session from request cookie", async () => {
    const issued = await issueSignedSession();
    const req = new Request("http://localhost/api/challenge", {
      headers: {
        cookie: `${SESSION_COOKIE}=${encodeURIComponent(issued.cookieValue)}`,
      },
    });
    const resolved = await resolveRequestSession(req);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.sessionId).toBe(issued.sessionId);
  });

  it("rejects unknown signed session not in store", async () => {
    const token = signSessionToken("deadbeefdeadbeefdeadbeefdeadbeef", Date.now() + 60_000);
    const req = new Request("http://localhost/", {
      headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` },
    });
    const resolved = await resolveRequestSession(req);
    expect(resolved.ok).toBe(false);
  });
});

describe("Phase 7 developer API keys", () => {
  it("creates project and verifies api key", () => {
    const project = createProject("Phase7 Test");
    const key = createApiKey({
      projectId: project.projectId,
      environment: "test",
    });
    expect("secret" in key).toBe(true);
    if ("secret" in key) {
      const ok = verifyApiKey(key.secret);
      expect(ok.ok).toBe(true);
      if (ok.ok) expect(ok.projectId).toBe(project.projectId);
    }
  });
});

describe("Phase 7 adaptive rules", () => {
  it("raises risk for dense polling + sparse interaction", () => {
    const engine = new RuleDecisionEngine({
      maxTimingRatio: 2.5,
      minFrames: 8,
      maxFrames: 40,
      maxRetries: 2,
      maxApiPerFrame: 2,
      minInteractions: 3,
    });
    const result = engine.evaluate(
      createFeatureSnapshot({
        challengeType: "temporal_object_tracking",
        difficulty: 1,
        completionTimeMs: 5000,
        frameCount: 90,
        apiRequestCount: 200,
        interactionEventCount: 1,
        retryCount: 0,
        challengeAgeMs: 5000,
        verified: true,
        decision: "pending",
      }),
    );
    expect(result.riskScore).toBeGreaterThan(0.2);
    expect(result.factors?.some((f) => f.code.startsWith("adaptive_"))).toBe(
      true,
    );
  });
});

describe("Phase 7 automation cost still documented", () => {
  it("computes cost with api calls", () => {
    expect(
      computeAutomationCost({
        timeToSolveMs: 1000,
        interactionCount: 2,
        framesObserved: 10,
        apiRequestCount: 20,
      }),
    ).toBe(4); // 1 + 1 + 1 + 1
  });
});
