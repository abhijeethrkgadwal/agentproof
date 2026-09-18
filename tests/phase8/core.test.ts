import { describe, expect, it, beforeEach } from "vitest";
import {
  authorizeChallengeRequest,
  resolveApiKeyFromRequest,
} from "@/lib/developers/auth";
import {
  createApiKey,
  createProject,
  revokeApiKey,
} from "@/lib/developers/keys";
import {
  RedisBackedChallengeStore,
} from "@/lib/storage/redisChallengeStore";
import {
  RedisRateLimitStore,
  RedisSessionStore,
  redisSetEx,
  type RedisLike,
} from "@/lib/storage/redis";
import type { StoredChallenge } from "@/lib/challenge/types";

describe("Phase 8 API key authorization", () => {
  it("allows test environment without a key", () => {
    const req = new Request("http://localhost/api/challenge", { method: "POST" });
    const result = authorizeChallengeRequest({
      request: req,
      environment: "test",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.keyPresent).toBe(false);
  });

  it("rejects live environment without a key", () => {
    const req = new Request("http://localhost/api/challenge", { method: "POST" });
    const result = authorizeChallengeRequest({
      request: req,
      environment: "live",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("api_key_required_for_live");
  });

  it("rejects invalid api keys (P0 — no silent ignore)", () => {
    const req = new Request("http://localhost/api/challenge", {
      method: "POST",
      headers: { "X-AgentProof-Key": "ap_test_thisisnotavalidkey0123456789" },
    });
    const result = authorizeChallengeRequest({
      request: req,
      environment: "test",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_api_key");
  });

  it("accepts valid test key and rejects test key for live", () => {
    const project = createProject("Phase8 Auth");
    const created = createApiKey({
      projectId: project.projectId,
      environment: "test",
    });
    expect("secret" in created).toBe(true);
    if (!("secret" in created)) return;

    const okReq = new Request("http://localhost/api/challenge", {
      method: "POST",
      headers: { "X-AgentProof-Key": created.secret },
    });
    const ok = authorizeChallengeRequest({
      request: okReq,
      environment: "test",
    });
    expect(ok.ok).toBe(true);

    const live = authorizeChallengeRequest({
      request: okReq,
      environment: "live",
    });
    expect(live.ok).toBe(false);
    if (!live.ok) expect(live.error).toBe("test_key_not_valid_for_live");
  });

  it("rejects revoked keys", () => {
    const project = createProject("Phase8 Revoke");
    const created = createApiKey({
      projectId: project.projectId,
      environment: "live",
    });
    expect("secret" in created).toBe(true);
    if (!("secret" in created)) return;
    revokeApiKey(created.record.keyId);
    const req = new Request("http://localhost/api/challenge", {
      method: "POST",
      headers: { "X-AgentProof-Key": created.secret },
    });
    const result = authorizeChallengeRequest({
      request: req,
      environment: "live",
    });
    expect(result.ok).toBe(false);
  });

  it("reads key from header or body helper", () => {
    const req = new Request("http://localhost/", {
      headers: { "X-AgentProof-Key": "from-header-xxxxxxxx" },
    });
    expect(resolveApiKeyFromRequest(req)).toBe("from-header-xxxxxxxx");
    expect(resolveApiKeyFromRequest(new Request("http://localhost/"), "from-body-yyyyyyyy")).toBe(
      "from-body-yyyyyyyy",
    );
  });
});

class MemoryRedis implements RedisLike {
  private store = new Map<string, { value: string; expiresAt?: number }>();
  private ttls = new Map<string, number>();

  async get(key: string) {
    const row = this.store.get(key);
    if (!row) return null;
    if (row.expiresAt && row.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return row.value;
  }

  async set(key: string, value: string, mode?: "EX", ttl?: number) {
    const expiresAt =
      mode === "EX" && typeof ttl === "number"
        ? Date.now() + ttl * 1000
        : undefined;
    this.store.set(key, { value, expiresAt });
    if (expiresAt) this.ttls.set(key, ttl!);
    return "OK";
  }

  async del(key: string) {
    this.store.delete(key);
    return 1;
  }

  async incr(key: string) {
    const cur = Number((await this.get(key)) ?? "0") + 1;
    const existing = this.store.get(key);
    this.store.set(key, { value: String(cur), expiresAt: existing?.expiresAt });
    return cur;
  }

  async expire(key: string, seconds: number) {
    const row = this.store.get(key);
    if (!row) return 0;
    row.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string) {
    const row = this.store.get(key);
    if (!row?.expiresAt) return -1;
    return Math.max(0, Math.ceil((row.expiresAt - Date.now()) / 1000));
  }

  async keys(pattern: string) {
    const prefix = pattern.replace("*", "");
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }

  async quit() {
    return "OK";
  }
}

describe("Phase 8 Redis store adapters", () => {
  let redis: MemoryRedis;

  beforeEach(() => {
    redis = new MemoryRedis();
  });

  it("redisSetEx uses EX args form", async () => {
    await redisSetEx(redis, "k", "v", 30);
    expect(await redis.get("k")).toBe("v");
    expect(await redis.ttl("k")).toBeGreaterThan(0);
  });

  it("shares challenge consume across logical clients", async () => {
    const a = new RedisBackedChallengeStore(redis);
    const b = new RedisBackedChallengeStore(redis);
    const challenge = {
      challengeId: "00000000-0000-4000-8000-000000000001",
      sessionId: "sess",
      consumed: false,
      lifecycle: "issued",
      failedAttempts: 0,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      groundTruth: { correctObjectId: "o1" },
      nonce: "n",
      issuedAt: new Date().toISOString(),
      difficulty: 1,
      challengeType: "temporal_object_tracking",
      instruction: "x",
      scene: { objects: [] },
      renderConfiguration: { objects: [] },
      activeWindowMs: 5000,
    } as unknown as StoredChallenge;

    await a.createChallenge(challenge);
    expect(await b.getChallenge(challenge.challengeId)).toBeTruthy();
    expect(await a.consumeChallenge(challenge.challengeId)).toBe(true);
    expect(await b.consumeChallenge(challenge.challengeId)).toBe(false);
    expect(await b.isConsumed(challenge.challengeId)).toBe(true);
  });

  it("distributes rate limits via RedisRateLimitStore", async () => {
    const store = new RedisRateLimitStore(redis);
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(await store.hit("client", 60_000, 3));
    }
    expect(results.filter((r) => r.allowed).length).toBe(3);
    expect(results.filter((r) => !r.allowed).length).toBe(2);
  });

  it("persists sessions in RedisSessionStore", async () => {
    const store = new RedisSessionStore(redis);
    await store.put({
      sessionId: "abc",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      environment: "test",
    });
    const got = await store.get("abc");
    expect(got?.sessionId).toBe("abc");
  });
});
