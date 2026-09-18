#!/usr/bin/env node
/**
 * Phase 6 Lab regression gates (CI-friendly).
 * Hard-fail if previously blocked security properties regress.
 * Also reports Lab V2 measurement attacks (not required to be zero).
 *
 * Usage: node scripts/lab/regression-gates.mjs [baseUrl]
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = (process.argv[2] ?? "http://127.0.0.1:43123").replace(/\/$/, "");
const OUT_DIR =
  process.env.ATTACK_EVIDENCE_DIR ??
  "/cursor/stores/bc-4c601bd1-025b-48a3-bcf8-1f47197d27b5/media";

const results = [];
const measurements = {};

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

async function main() {
  // --- Offline derivation / static payload extraction ---
  const issued = await post("/api/challenge", { difficulty: 1 });
  const payload = issued.json;
  const text = JSON.stringify(payload);
  const hasSegments = text.includes("segments");
  const hasRender = "renderConfiguration" in payload;
  const hasVelocity = text.includes("velocity");
  const hasGT =
    text.includes("correctObjectId") || text.includes("groundTruth");
  gate(
    "offline_derivation_blocked",
    !hasSegments && !hasRender && payload.lifecycle === "issued",
    `keys=${Object.keys(payload).join(",")}; segments=${hasSegments}`,
  );
  gate(
    "static_payload_extraction_blocked",
    !hasSegments && !hasVelocity && !hasGT,
    `velocity=${hasVelocity} gt=${hasGT}`,
  );

  // --- Direct / premature ---
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
    "premature_verification_blocked",
    direct.status === 409 || direct.status === 425 || direct.status === 403,
    `status=${direct.status} error=${direct.json.error}`,
  );

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
    "timing_early_verify_blocked",
    premature.status === 425 || premature.status === 409,
    `status=${premature.status} error=${premature.json.error}`,
  );

  // --- Replay ---
  const c2 = await post("/api/challenge", { difficulty: 1 });
  const cookie2 = cookieHeader(c2.setCookie);
  await post(
    "/api/challenge/start",
    { challengeId: c2.json.challengeId, token: c2.json.token },
    cookie2,
  );
  await new Promise((r) =>
    setTimeout(r, (c2.json.scene?.durationMs ?? 5000) * 0.9),
  );
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

  // --- Tamper ---
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

  // --- Expired challenge ---
  const c4 = await post("/api/challenge", { difficulty: 1 });
  const cookie4 = cookieHeader(c4.setCookie);
  // Force expiry via internal store is not available over HTTP; emulate by
  // waiting is too slow. Instead: corrupt expires by using a made-up id after
  // a fresh challenge that we never start — verify should 404/410/409.
  // Stronger: start then verify with wrong challenge binding after TTL isn't
  // practical in CI. Use a synthetic expired token path: challenge not found
  // after clear isn't possible. We check that verify on unknown id → 404,
  // and document TTL gate via unit tests. Here: verify with random UUID.
  const expired = await post(
    "/api/verify",
    {
      challengeId: "00000000-0000-4000-8000-000000000099",
      token: c4.json.token,
      selectedObjectId: "object_1",
    },
    cookie4,
  );
  gate(
    "expired_or_unknown_challenge_blocked",
    expired.status === 400 ||
      expired.status === 401 ||
      expired.status === 404 ||
      expired.status === 410,
    `status=${expired.status} error=${expired.json.error}`,
  );

  // --- Lab V2 measurement suite (report; hard-fail only if security bypass) ---
  console.log("\nRunning Lab V2 measurement attacks…");
  const v2 = await post("/api/lab/v2", { attack: "all", difficulty: 1 });
  const runs = v2.json.runs ?? [];
  for (const run of runs) {
    measurements[run.attackName] = {
      success: run.success,
      cost: run.automationCost,
      failureReason: run.failureReason,
      notes: run.notes,
    };
    console.log(
      `  ${run.attackName}: attacker_success=${run.success} cost=${run.automationCost} reason=${run.failureReason}`,
    );
  }

  const timing = runs.find((r) => r.attackName === "timing_attack");
  const directA = runs.find((r) => r.attackName === "direct_api_attack");
  const replayA = runs.find((r) => r.attackName === "replay_tampering");
  const frameA = runs.find((r) => r.attackName === "frame_reconstruction_v2");
  const pollA = runs.find((r) => r.attackName === "polling_optimisation");

  // Hard fail if attacker *succeeds* at security-bypass attacks
  gate(
    "lab_v2_timing_bypass_must_fail",
    timing ? timing.success === false : false,
    timing
      ? `success=${timing.success} notes=${timing.notes}`
      : "timing_attack missing",
  );
  gate(
    "lab_v2_direct_api_bypass_must_fail",
    directA ? directA.success === false : false,
    directA
      ? `success=${directA.success} notes=${directA.notes}`
      : "direct_api missing",
  );
  gate(
    "lab_v2_replay_tamper_bypass_must_fail",
    replayA ? replayA.success === false : false,
    replayA
      ? `success=${replayA.success} notes=${replayA.notes}`
      : "replay_tampering missing",
  );

  // Measurement-only reporting
  gate(
    "measure_frame_reconstruction_v2",
    true,
    `attacker_success=${frameA?.success ?? "n/a"} cost=${frameA?.automationCost ?? "n/a"}`,
  );
  gate(
    "measure_adaptive_smoothing_polling",
    true,
    `attacker_success=${pollA?.success ?? "n/a"} cost=${pollA?.automationCost ?? "n/a"}`,
  );
  gate(
    "measure_direct_api",
    true,
    `attacker_success=${directA?.success ?? "n/a"}`,
  );

  // Phase 7: polling residual suppressed — sample multiple batches.
  // Exact attacker unchanged; shotgun of 3 intervals ≈ chance among ~7 objects.
  // Require ≤1/5 batch successes (≤20%), vs Phase 6 single-run residual pass.
  console.log("\nSampling polling_optimisation × 5…");
  const pollSamples = [];
  for (let i = 0; i < 5; i += 1) {
    const one = await post("/api/lab/v2", {
      attack: "polling_optimisation",
      difficulty: 1,
    });
    const run = one.json.runs?.[0];
    pollSamples.push(Boolean(run?.success));
    console.log(`  sample ${i + 1}: success=${run?.success}`);
  }
  const pollHits = pollSamples.filter(Boolean).length;
  gate(
    "polling_optimisation_suppressed",
    pollHits <= 1,
    `batchSuccesses=${pollHits}/5 (threshold<=1); samples=${pollSamples.join(",")}`,
  );

  const hardGates = results.filter(
    (r) => !r.name.startsWith("measure_"),
  );
  const summary = {
    baseUrl: BASE,
    gates: results,
    measurements,
    passed: hardGates.every((r) => r.ok),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, "phase-7-regression-gates.json"),
    JSON.stringify(summary, null, 2),
  );
  writeFileSync(
    join(OUT_DIR, "phase-6-regression-gates.json"),
    JSON.stringify(summary, null, 2),
  );

  console.log("\n===== GATE SUMMARY =====");
  console.log(
    JSON.stringify(
      { passed: summary.passed, measurements: summary.measurements },
      null,
      2,
    ),
  );
  if (!summary.passed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
