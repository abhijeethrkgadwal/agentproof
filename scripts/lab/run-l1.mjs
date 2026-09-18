#!/usr/bin/env node
/**
 * CLI: run L1 API observer batch against a live AgentProof instance.
 * Usage: node scripts/lab/run-l1.mjs [baseUrl] [count]
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const BASE = (process.argv[2] ?? "http://127.0.0.1:43123").replace(/\/$/, "");
const COUNT = Number(process.argv[3] ?? "5");
const DATA_DIR = join(process.cwd(), "data", "lab-runs");
const DATA_FILE = join(DATA_DIR, "runs.json");

const THRESHOLD = Math.PI / 6;

function countChanges(samples) {
  if (samples.length < 4) return 0;
  const windows = Math.min(12, Math.max(6, Math.floor(samples.length / 3)));
  const step = Math.max(1, Math.floor((samples.length - 1) / windows));
  const picked = [];
  for (let i = 0; i < samples.length; i += step) picked.push(samples[i]);
  const last = samples[samples.length - 1];
  if (picked[picked.length - 1] !== last) picked.push(last);
  const velocities = [];
  for (let i = 1; i < picked.length; i += 1) {
    const dt = (picked[i].t - picked[i - 1].t) / 1000;
    if (dt <= 0.02) continue;
    const vx = (picked[i].x - picked[i - 1].x) / dt;
    const vy = (picked[i].y - picked[i - 1].y) / dt;
    if (Math.hypot(vx, vy) < 15) continue;
    velocities.push({ x: vx, y: vy });
  }
  if (velocities.length < 2) return 0;
  let changes = 0;
  for (let i = 1; i < velocities.length; i += 1) {
    const prev = velocities[i - 1];
    const curr = velocities[i];
    const a1 = Math.atan2(prev.y, prev.x);
    const a2 = Math.atan2(curr.y, curr.x);
    let delta = Math.abs(a2 - a1);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    if (delta > THRESHOLD) changes += 1;
  }
  return changes;
}

function cost({ timeToSolveMs, actions, framesObserved }) {
  return Number(
    (timeToSolveMs / 1000 + actions * 0.5 + framesObserved * 0.1).toFixed(3),
  );
}

function load() {
  if (!existsSync(DATA_FILE)) return [];
  return JSON.parse(readFileSync(DATA_FILE, "utf8"));
}

function save(runs) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(runs, null, 2));
}

async function runOnce() {
  let cookie = "";
  let apiCalls = 0;
  let framesObserved = 0;
  let actions = 0;
  const t0 = Date.now();

  const post = async (path, body) => {
    apiCalls += 1;
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    const sc = res.headers.getSetCookie?.() ?? [];
    if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
    else if (res.headers.get("set-cookie")) {
      cookie = res.headers.get("set-cookie").split(";")[0];
    }
    return { status: res.status, json: await res.json() };
  };

  const issued = await post("/api/challenge", { difficulty: 1 });
  const challenge = issued.json;
  actions += 1;
  await post("/api/challenge/start", {
    challengeId: challenge.challengeId,
    token: challenge.token,
  });

  const trails = {};
  let complete = false;
  const deadline = Date.now() + challenge.scene.durationMs + 1500;
  while (!complete && Date.now() < deadline) {
    const frame = await post("/api/challenge/frame", {
      challengeId: challenge.challengeId,
      token: challenge.token,
    });
    if (frame.status === 200) {
      framesObserved += 1;
      for (const pose of frame.json.poses ?? []) {
        if (!trails[pose.id]) trails[pose.id] = [];
        trails[pose.id].push({
          t: frame.json.elapsedMs,
          x: pose.x,
          y: pose.y,
        });
      }
      complete = Boolean(frame.json.complete);
    }
    if (!complete) await new Promise((r) => setTimeout(r, 120));
  }

  const required = Number(
    (challenge.instruction.match(/exactly\s+(\d+)\s+time/i) || [])[1] || 2,
  );
  const counts = Object.fromEntries(
    Object.entries(trails).map(([id, s]) => [id, countChanges(s)]),
  );
  const matches = Object.entries(counts).filter(([, c]) => c === required);
  const objectId =
    matches.length === 1
      ? matches[0][0]
      : Object.keys(counts).sort(
          (a, b) => Math.abs(counts[a] - required) - Math.abs(counts[b] - required),
        )[0];

  actions += 1;
  const verify = await post("/api/verify", {
    challengeId: challenge.challengeId,
    token: challenge.token,
    selectedObjectId: objectId,
    telemetry: {
      completionTimeMs: Date.now() - t0,
      interactionEventCount: framesObserved,
    },
  });

  const timeToSolveMs = Date.now() - t0;
  const success = verify.status === 200 && verify.json.verified === true;
  return {
    runId: randomUUID(),
    level: "l1_api_observer",
    difficulty: 1,
    challengeId: challenge.challengeId,
    status: success ? "success" : "failure",
    success,
    timeToSolveMs,
    apiCalls,
    framesObserved,
    actions,
    automationCost: cost({ timeToSolveMs, actions, framesObserved }),
    verificationResult: {
      verified: verify.json.verified,
      decision: verify.json.decision,
      riskScore: verify.json.riskScore,
      status: verify.status,
    },
    notes: `derived=${objectId}; counts=${JSON.stringify(counts)}; required=${required}`,
    createdAt: new Date().toISOString(),
  };
}

const runs = load();
const batch = [];
for (let i = 0; i < COUNT; i += 1) {
  console.log(`L1 run ${i + 1}/${COUNT}`);
  const r = await runOnce();
  batch.push(r);
  runs.push(r);
}
save(runs);
console.log(
  `L1 done: ${batch.filter((r) => r.success).length}/${batch.length} success`,
);
console.log(JSON.stringify(batch, null, 2));
