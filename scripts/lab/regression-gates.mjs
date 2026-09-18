#!/usr/bin/env node
/**
 * Phase 5 Lab regression gates (CI-friendly).
 * Covers: offline derivation, frame-trail, direct API, replay, tamper, timing.
 *
 * Usage: node scripts/lab/regression-gates.mjs [baseUrl]
 * Exit 0 = all gates pass; non-zero = regression.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = (process.argv[2] ?? "http://127.0.0.1:43123").replace(/\/$/, "");
const OUT_DIR =
  process.env.ATTACK_EVIDENCE_DIR ??
  "/cursor/stores/bc-4c601bd1-025b-48a3-bcf8-1f47197d27b5/media";

/** Max allowed L1 success rate after light harden (Phase 4 was ~0.11). */
const MAX_L1_SUCCESS = Number(process.env.LAB_GATE_MAX_L1_SUCCESS ?? "0.09");
/**
 * Min *expected* Automation Cost = medianCost / successRate (Phase 4 ≈ 10.2/0.11 ≈ 93).
 * Vacuous pass if zero successes (infinite expected cost).
 */
const MIN_L1_EXPECTED_COST = Number(
  process.env.LAB_GATE_MIN_L1_EXPECTED_COST ?? "110",
);
const L1_SAMPLES = Number(process.env.LAB_GATE_L1_SAMPLES ?? "16");

const results = [];

function gate(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  console.log(`      ${detail}`);
}

async function post(path, body, cookie) {
  const res = await fetch(`${BASE}${path}`, {
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

function cookieHeader(setCookie) {
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

async function runL1Once() {
  // Inline minimal L1 (same strategy as scripts/lab/run-l1.mjs)
  let cookie = "";
  let apiCalls = 0;
  let framesObserved = 0;
  let actions = 0;
  const t0 = Date.now();
  const doPost = async (path, body) => {
    apiCalls += 1;
    const res = await post(path, body, cookie);
    if (res.setCookie.length) cookie = cookieHeader(res.setCookie);
    return res;
  };

  const issued = await doPost("/api/challenge", { difficulty: 1 });
  const challenge = issued.json;
  actions += 1;
  await doPost("/api/challenge/start", {
    challengeId: challenge.challengeId,
    token: challenge.token,
  });

  const trails = {};
  let complete = false;
  const deadline = Date.now() + (challenge.scene?.durationMs ?? 5000) + 1500;
  while (!complete && Date.now() < deadline) {
    const frame = await doPost("/api/challenge/frame", {
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
  const THRESHOLD = Math.PI / 6;
  const countChanges = (samples) => {
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
      const a1 = Math.atan2(velocities[i - 1].y, velocities[i - 1].x);
      const a2 = Math.atan2(velocities[i].y, velocities[i].x);
      let delta = Math.abs(a2 - a1);
      if (delta > Math.PI) delta = 2 * Math.PI - delta;
      if (delta > THRESHOLD) changes += 1;
    }
    return changes;
  };

  const counts = Object.fromEntries(
    Object.entries(trails).map(([id, s]) => [id, countChanges(s)]),
  );
  const matches = Object.entries(counts).filter(([, c]) => c === required);
  const objectId =
    matches.sort((a, b) => (trails[b[0]]?.length ?? 0) - (trails[a[0]]?.length ?? 0))[0]?.[0] ??
    Object.keys(counts).sort(
      (a, b) => Math.abs(counts[a] - required) - Math.abs(counts[b] - required),
    )[0];

  actions += 1;
  const verify = await doPost("/api/verify", {
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
  const automationCost = Number(
    (timeToSolveMs / 1000 + actions * 0.5 + framesObserved * 0.1).toFixed(3),
  );
  return { success, timeToSolveMs, framesObserved, apiCalls, actions, automationCost };
}

async function main() {
  // --- 1. Offline derivation ---
  const issued = await post("/api/challenge", { difficulty: 1 });
  const payload = issued.json;
  const hasSegments = JSON.stringify(payload).includes("segments");
  const hasRender = "renderConfiguration" in payload;
  gate(
    "offline_derivation_blocked",
    !hasSegments && !hasRender && payload.lifecycle === "issued",
    `keys=${Object.keys(payload).join(",")}; segments=${hasSegments}`,
  );

  // --- 3. Direct API solving (before start) ---
  const cookie = cookieHeader(issued.setCookie);
  const direct = await post(
    "/api/verify",
    {
      challengeId: payload.challengeId,
      token: payload.token,
      selectedObjectId: payload.scene.objects[0].id,
      telemetry: { completionTimeMs: 1, interactionEventCount: 0 },
    },
    cookie,
  );
  gate(
    "direct_api_solve_blocked",
    direct.status === 409 || direct.status === 425 || direct.status === 403,
    `status=${direct.status} error=${direct.json.error}`,
  );

  // --- 6. Timing manipulation (start then immediate verify) ---
  await post(
    "/api/challenge/start",
    { challengeId: payload.challengeId, token: payload.token },
    cookie,
  );
  const premature = await post(
    "/api/verify",
    {
      challengeId: payload.challengeId,
      token: payload.token,
      selectedObjectId: payload.scene.objects[0].id,
      telemetry: { completionTimeMs: 10, interactionEventCount: 1 },
    },
    cookie,
  );
  gate(
    "timing_manipulation_blocked",
    premature.status === 425 || premature.status === 409,
    `status=${premature.status} error=${premature.json.error}`,
  );

  // Fresh challenge for replay/tamper (need full active window)
  const c2 = await post("/api/challenge", { difficulty: 1 });
  const cookie2 = cookieHeader(c2.setCookie);
  await post(
    "/api/challenge/start",
    { challengeId: c2.json.challengeId, token: c2.json.token },
    cookie2,
  );
  await new Promise((r) => setTimeout(r, (c2.json.scene?.durationMs ?? 5000) * 0.9));
  const first = await post(
    "/api/verify",
    {
      challengeId: c2.json.challengeId,
      token: c2.json.token,
      selectedObjectId: c2.json.scene.objects[0].id,
      telemetry: { completionTimeMs: 5000, interactionEventCount: 4 },
    },
    cookie2,
  );
  const replay = await post(
    "/api/verify",
    {
      challengeId: c2.json.challengeId,
      token: c2.json.token,
      selectedObjectId: c2.json.scene.objects[0].id,
      telemetry: {},
    },
    cookie2,
  );
  gate(
    "replay_blocked",
    replay.status === 409,
    `first=${first.status} replay=${replay.status}/${replay.json.error}`,
  );

  const c3 = await post("/api/challenge", { difficulty: 1 });
  const cookie3 = cookieHeader(c3.setCookie);
  const badSig = `${c3.json.token.split(".")[0]}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
  const tamper = await post(
    "/api/verify",
    {
      challengeId: c3.json.challengeId,
      token: badSig,
      selectedObjectId: "object_1",
    },
    cookie3,
  );
  gate(
    "tamper_blocked",
    tamper.status === 401,
    `status=${tamper.status} error=${tamper.json.error}`,
  );

  // --- 2. Frame-trail reconstruction (L1 sample batch) ---
  console.log(`\nRunning L1 frame-trail samples × ${L1_SAMPLES}…`);
  const l1Runs = [];
  for (let i = 0; i < L1_SAMPLES; i += 1) {
    process.stdout.write(`  L1 ${i + 1}/${L1_SAMPLES}\r`);
    l1Runs.push(await runL1Once());
  }
  console.log("");
  const succ = l1Runs.filter((r) => r.success);
  const rate = succ.length / l1Runs.length;
  const costs = succ.map((r) => r.automationCost).sort((a, b) => a - b);
  const medianCost =
    costs.length === 0
      ? null
      : costs.length % 2
        ? costs[(costs.length - 1) / 2]
        : (costs[costs.length / 2 - 1] + costs[costs.length / 2]) / 2;
  const times = succ.map((r) => r.timeToSolveMs).sort((a, b) => a - b);
  const medianTime = times.length ? times[Math.floor(times.length / 2)] : null;
  const frames = succ.map((r) => r.framesObserved).sort((a, b) => a - b);
  const medianFrames = frames.length ? frames[Math.floor(frames.length / 2)] : null;

  // Gate: success rate must drop vs Phase 4 (~11%), and expected cost
  // (medianCost / rate) must rise materially. Zero successes ⇒ pass.
  const expectedCost =
    rate > 0 && medianCost !== null ? medianCost / rate : null;
  const rateOk = rate <= MAX_L1_SUCCESS;
  const costOk =
    succ.length === 0 ||
    (expectedCost !== null && expectedCost >= MIN_L1_EXPECTED_COST);
  gate(
    "frame_trail_cost_or_rate",
    rateOk && costOk,
    `L1 success=${succ.length}/${l1Runs.length} (${(rate * 100).toFixed(1)}%) medianCost=${medianCost} expectedCost=${expectedCost === null ? "inf" : expectedCost.toFixed(1)} medianTime=${medianTime} medianFrames=${medianFrames} thresholds rate<=${MAX_L1_SUCCESS} expectedCost>=${MIN_L1_EXPECTED_COST}`,
  );

  const summary = {
    baseUrl: BASE,
    gates: results,
    l1: {
      samples: L1_SAMPLES,
      successRate: rate,
      successes: succ.length,
      medianAutomationCost: medianCost,
      expectedAutomationCost: expectedCost,
      medianSolveMs: medianTime,
      medianFrames,
      runs: l1Runs,
    },
    passed: results.every((r) => r.ok),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, "phase-5-regression-gates.json"),
    JSON.stringify(summary, null, 2),
  );

  console.log("\n===== GATE SUMMARY =====");
  console.log(JSON.stringify({ passed: summary.passed, l1: summary.l1 }, null, 2));
  if (!summary.passed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
