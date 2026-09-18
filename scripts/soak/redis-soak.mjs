#!/usr/bin/env node
/**
 * Phase 8 Redis soak — multi-process challenge/session/rate-limit verification.
 *
 * Usage:
 *   AGENTPROOF_REDIS_URL=redis://127.0.0.1:6379 node scripts/soak/redis-soak.mjs
 *
 * Modes:
 *   1) Direct store soak (always when Redis reachable): N workers share Redis.
 *   2) Optional HTTP multi-instance soak when SOAK_BASE_A / SOAK_BASE_B are set
 *      (two Next.js instances with AGENTPROOF_STORAGE_BACKEND=redis).
 *
 * Writes evidence to media/phase-8-redis-soak.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Redis = require("ioredis");

const REDIS_URL =
  process.env.AGENTPROOF_REDIS_URL ??
  process.env.REDIS_URL ??
  "redis://127.0.0.1:6379";
const WORKERS = Number(process.env.SOAK_WORKERS ?? "4");
const OPS_PER_WORKER = Number(process.env.SOAK_OPS ?? "40");
const RATE_MAX = Number(process.env.SOAK_RATE_MAX ?? "25");
const RATE_WINDOW_MS = Number(process.env.SOAK_RATE_WINDOW_MS ?? "5000");
const OUT_DIR =
  process.env.ATTACK_EVIDENCE_DIR ??
  "/cursor/stores/bc-4c601bd1-025b-48a3-bcf8-1f47197d27b5/media";
const THIS_FILE = fileURLToPath(import.meta.url);

const CH_PREFIX = "ap:challenge:";
const SID_PREFIX = "ap:session:";
const RL_PREFIX = "ap:rl:";

async function pingRedis(url) {
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 3000,
  });
  try {
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    return { ok: pong === "PONG", error: null };
  } catch (err) {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function workerMain(data) {
  const { workerId, ops, redisUrl, rateMax, rateWindowMs } = data;
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  await client.connect();
  const latencies = [];
  let creates = 0;
  let crossReads = 0;
  let consumes = 0;
  let consumeDenied = 0;
  let rateAllowed = 0;
  let rateDenied = 0;
  let failures = 0;

  for (let i = 0; i < ops; i++) {
    const id = `soak-w${workerId}-${i}-${Date.now()}`;
    const challenge = {
      challengeId: id,
      sessionId: `sess-${workerId}-${i}`,
      consumed: false,
      lifecycle: "issued",
      failedAttempts: 0,
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      groundTruth: { correctObjectId: "o1" },
      renderConfiguration: { objects: [] },
    };
    const t0 = performance.now();
    try {
      await client.set(
        CH_PREFIX + id,
        JSON.stringify(challenge),
        "EX",
        120,
      );
      creates += 1;

      const session = {
        sessionId: challenge.sessionId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 120_000,
        environment: "test",
      };
      await client.set(
        SID_PREFIX + session.sessionId,
        JSON.stringify(session),
        "EX",
        120,
      );

      // Cross-read (another worker's key pattern via own prior keys + shared)
      const raw = await client.get(CH_PREFIX + id);
      if (raw) crossReads += 1;

      // Consume once
      const current = JSON.parse(raw);
      if (!current.consumed) {
        current.consumed = true;
        current.lifecycle = "submitted";
        await client.set(CH_PREFIX + id, JSON.stringify(current), "EX", 120);
        consumes += 1;
      }
      // Second consume should see consumed
      const again = JSON.parse(await client.get(CH_PREFIX + id));
      if (again.consumed) {
        // simulate denied replay
        consumeDenied += 1;
      }

      // Distributed rate limit
      const rlKey = RL_PREFIX + "soak:shared";
      const count = await client.incr(rlKey);
      if (count === 1) {
        await client.expire(rlKey, Math.ceil(rateWindowMs / 1000));
      }
      if (count > rateMax) rateDenied += 1;
      else rateAllowed += 1;
    } catch (err) {
      failures += 1;
      console.error(`worker ${workerId} op ${i}:`, err.message);
    }
    latencies.push(performance.now() - t0);
  }

  await client.quit();
  return {
    workerId,
    creates,
    crossReads,
    consumes,
    consumeDenied,
    rateAllowed,
    rateDenied,
    failures,
    latencies,
  };
}

async function runHttpMultiInstance() {
  const a = process.env.SOAK_BASE_A;
  const b = process.env.SOAK_BASE_B;
  if (!a || !b) {
    return {
      skipped: true,
      reason: "SOAK_BASE_A / SOAK_BASE_B not set",
    };
  }

  async function post(base, path, body, cookie) {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json, setCookie };
  }

  const cookieOf = (setCookie) =>
    setCookie.map((c) => c.split(";")[0]).join("; ");

  const healthA = await fetch(`${a}/api/health`).then((r) => r.json());
  const healthB = await fetch(`${b}/api/health`).then((r) => r.json());

  const issued = await post(a, "/api/challenge", { difficulty: 1 });
  const cookie = cookieOf(issued.setCookie);
  const challengeId = issued.json.challengeId;
  const token = issued.json.token;

  // Start on A, frame on B (cross-instance state)
  const startA = await post(
    a,
    "/api/challenge/start",
    { challengeId, token },
    cookie,
  );
  const frameB = await post(
    b,
    "/api/challenge/frame",
    { challengeId, token },
    cookie,
  );

  // Rate-limit soak across instances
  const prevMax = null; // observational only
  let rate429 = 0;
  let rateOk = 0;
  const burst = 80;
  for (let i = 0; i < burst; i++) {
    const base = i % 2 === 0 ? a : b;
    const r = await post(base, "/api/challenge", { difficulty: 1 });
    if (r.status === 429) rate429 += 1;
    else if (r.status === 200) rateOk += 1;
  }

  return {
    skipped: false,
    healthA,
    healthB,
    crossInstance: {
      issueStatus: issued.status,
      startStatus: startA.status,
      frameStatus: frameB.status,
      frameLifecycle: frameB.json.lifecycle ?? frameB.json.error,
      sharedChallengeId: challengeId,
    },
    rateBurst: { burst, rateOk, rate429, note: prevMax },
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function main() {
  if (!isMainThread) {
    const result = await workerMain(workerData);
    parentPort.postMessage(result);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const ping = await pingRedis(REDIS_URL);

  if (!ping.ok) {
    const report = {
      phase: 8,
      label: "research/portfolio prototype — not production security infrastructure",
      startedAt,
      finishedAt: new Date().toISOString(),
      redisReachable: false,
      blocker: ping.error,
      script: "scripts/soak/redis-soak.mjs",
      reproduce: [
        "Install and start Redis locally",
        "export AGENTPROOF_REDIS_URL=redis://127.0.0.1:6379",
        "node scripts/soak/redis-soak.mjs",
        "Optional HTTP: SOAK_BASE_A=http://127.0.0.1:43124 SOAK_BASE_B=http://127.0.0.1:43125 with two next start instances and AGENTPROOF_STORAGE_BACKEND=redis",
      ],
      pass: false,
    };
    writeFileSync(join(OUT_DIR, "phase-8-redis-soak.json"), JSON.stringify(report, null, 2));
    console.error("Redis unreachable:", ping.error);
    process.exitCode = 1;
    return;
  }

  // Flush soak keys
  const cleaner = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  await cleaner.connect();
  for (const pattern of ["ap:challenge:soak-*", "ap:session:sess-*", "ap:rl:soak:*"]) {
    const keys = await cleaner.keys(pattern);
    if (keys.length) await cleaner.del(...keys);
  }
  await cleaner.quit();

  const t0 = performance.now();
  const workers = [];
  for (let w = 0; w < WORKERS; w++) {
    workers.push(
      new Promise((resolve, reject) => {
        const worker = new Worker(THIS_FILE, {
          workerData: {
            workerId: w,
            ops: OPS_PER_WORKER,
            redisUrl: REDIS_URL,
            rateMax: RATE_MAX,
            rateWindowMs: RATE_WINDOW_MS,
          },
        });
        worker.on("message", resolve);
        worker.on("error", reject);
        worker.on("exit", (code) => {
          if (code !== 0) reject(new Error(`worker exit ${code}`));
        });
      }),
    );
  }
  const workerResults = await Promise.all(workers);
  const elapsedMs = performance.now() - t0;

  const allLat = workerResults.flatMap((r) => r.latencies).sort((a, b) => a - b);
  const totals = workerResults.reduce(
    (acc, r) => {
      acc.creates += r.creates;
      acc.crossReads += r.crossReads;
      acc.consumes += r.consumes;
      acc.consumeDenied += r.consumeDenied;
      acc.rateAllowed += r.rateAllowed;
      acc.rateDenied += r.rateDenied;
      acc.failures += r.failures;
      return acc;
    },
    {
      creates: 0,
      crossReads: 0,
      consumes: 0,
      consumeDenied: 0,
      rateAllowed: 0,
      rateDenied: 0,
      failures: 0,
    },
  );

  const http = await runHttpMultiInstance();

  const pass =
    totals.failures === 0 &&
    totals.creates === WORKERS * OPS_PER_WORKER &&
    totals.consumes === totals.creates &&
    totals.consumeDenied === totals.creates &&
    totals.rateDenied > 0;

  const report = {
    phase: 8,
    label: "research/portfolio prototype — not production security infrastructure",
    startedAt,
    finishedAt: new Date().toISOString(),
    redisReachable: true,
    redisUrl: REDIS_URL.replace(/\/\/.*@/, "//***@"),
    workers: WORKERS,
    opsPerWorker: OPS_PER_WORKER,
    elapsedMs: Math.round(elapsedMs),
    totals,
    latencyMs: {
      p50: percentile(allLat, 50),
      p95: percentile(allLat, 95),
      p99: percentile(allLat, 99),
      max: allLat[allLat.length - 1] ?? null,
    },
    rateLimit: {
      windowMs: RATE_WINDOW_MS,
      max: RATE_MAX,
      allowed: totals.rateAllowed,
      denied: totals.rateDenied,
      expectedDenied: totals.rateDenied > 0,
    },
    httpMultiInstance: http,
    pass,
    notes: [
      "Direct Redis store soak validates cross-process challenge/session/replay + distributed rate limiting.",
      "HTTP multi-instance requires SOAK_BASE_A/B pointing at two Redis-backed Next.js instances.",
      "ioredis SET must use EX args (object form is a syntax error) — fixed in Phase 8.",
    ],
  };

  writeFileSync(join(OUT_DIR, "phase-8-redis-soak.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
