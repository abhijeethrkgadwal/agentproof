#!/usr/bin/env node
/**
 * Phase 8 final Lab benchmark — historical attack matrix + Lab V2 + Automation Cost.
 * Separates human study aggregates from automated attacks.
 * Does NOT claim "AI-proof."
 *
 * Usage: node scripts/lab/final-benchmark.mjs [baseUrl]
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.argv[2] ?? "http://127.0.0.1:43123").replace(/\/$/, "");
const OUT_DIR =
  process.env.ATTACK_EVIDENCE_DIR ??
  "/cursor/stores/bc-4c601bd1-025b-48a3-bcf8-1f47197d27b5/media";
const STORE =
  "/cursor/stores/bc-4c601bd1-025b-48a3-bcf8-1f47197d27b5";

function loadJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
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

function automationCost(r) {
  return (
    (r.solveTimeMs ?? r.timeToSolveMs ?? 0) / 1000 +
    0.5 * (r.interactionCount ?? 0) +
    0.1 * (r.frameCount ?? r.framesObserved ?? 0) +
    0.05 * (r.apiRequestCount ?? 0)
  );
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const startedAt = new Date().toISOString();

  // --- Live gates snapshot ---
  const issued = await post("/api/challenge", { difficulty: 1 });
  const payload = issued.json;
  const text = JSON.stringify(payload);
  const offlineBlocked =
    !text.includes("segments") &&
    !("renderConfiguration" in payload) &&
    payload.lifecycle === "issued";

  const cookie = cookieHeader(issued.setCookie);
  const premature = await post(
    "/api/verify",
    {
      challengeId: payload.challengeId,
      token: payload.token,
      selectedObjectId: payload.scene?.objects?.[0]?.id ?? "x",
      telemetry: { completionTimeMs: 1, interactionEventCount: 0 },
    },
    cookie,
  );

  // Lab V2 all
  const v2 = await post("/api/lab/v2", { attack: "all", difficulty: 1 });
  const v2Runs = Array.isArray(v2.json.runs)
    ? v2.json.runs
    : Array.isArray(v2.json.results)
      ? v2.json.results
      : [];

  // Human aggregates
  const study = await fetch(`${BASE}/api/study/aggregate`)
    .then((r) => r.json())
    .catch(() => ({}));
  const bench = await fetch(`${BASE}/api/lab/benchmark`)
    .then((r) => r.json())
    .catch(() => ({}));

  // Historical artifacts (if present)
  const historical = {
    phase2: loadJson(join(OUT_DIR, "phase-2-attack-matrix.json")),
    phase3: loadJson(join(OUT_DIR, "phase-3-attack-retest.json")),
    phase6Gates: loadJson(join(OUT_DIR, "phase-6-regression-gates.json")),
    phase7Gates: loadJson(join(OUT_DIR, "phase-7-regression-gates.json")),
  };

  const attackMatrix = [
    {
      phase: 2,
      attack: "offline_payload_derivation",
      category: "automated",
      thenSuccess: historical.phase2
        ? Boolean(
            historical.phase2.results?.some?.(
              (r) => r.attack?.includes?.("Inspect") && r.pass,
            ) ?? historical.phase2.summary?.passed > 0,
          )
        : "see phase-2 artifact",
      nowBlocked: offlineBlocked,
      note: "Phase 3 removed motion segments from public challenge",
    },
    {
      phase: 3,
      attack: "static_gt_extraction",
      category: "automated",
      nowBlocked: !text.includes("correctObjectId") && !text.includes("groundTruth"),
    },
    {
      phase: 4,
      attack: "lab_l1_frame_reconstruction",
      category: "automated_measurement",
      note: "Measured via lab:l1 / gates — success may be non-zero; not a security claim",
    },
    {
      phase: 5,
      attack: "decision_c_hardening",
      category: "automated",
      note: "Display harden + risk engine; no Jev",
    },
    {
      phase: 6,
      attack: "lab_v2_A_F",
      category: "automated",
      runs: v2Runs.map((r) => ({
        name: r.attackName ?? r.name ?? r.attack,
        success: r.success,
        solveTimeMs: r.solveTimeMs ?? r.timeToSolveMs,
        frames: r.frameCount ?? r.framesObserved,
        apiCalls: r.apiRequestCount,
        interactions: r.interactionCount,
        automationCost: r.automationCost ?? automationCost(r),
        failureReason: r.failureReason,
      })),
    },
    {
      phase: 7,
      attack: "polling_optimisation_residual",
      category: "automated",
      note: "Gate requires ≤1/5 successes after GT-biased warp / lag",
      historicalGate: historical.phase7Gates?.measurements ?? null,
    },
  ];

  const report = {
    phase: 8,
    label: "research/portfolio prototype — not production security infrastructure",
    disclaimer:
      "AgentProof does not claim to be AI-proof. Automated success rates are lab measurements under controlled conditions.",
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl: BASE,
    liveChecks: {
      offlineDerivationBlocked: offlineBlocked,
      prematureVerifyStatus: premature.status,
      prematureBlocked:
        premature.status === 409 ||
        premature.status === 425 ||
        premature.status === 403,
    },
    humanObservations: {
      source: "/api/study/aggregate",
      aggregate: study.aggregate ?? study,
      separatedFromAutomated: true,
    },
    labBenchmarkApi: bench,
    attackMatrix,
    historicalArtifactsPresent: {
      phase2: Boolean(historical.phase2),
      phase3: Boolean(historical.phase3),
      phase6Gates: Boolean(historical.phase6Gates),
      phase7Gates: Boolean(historical.phase7Gates),
    },
    storePath: STORE,
  };

  writeFileSync(
    join(OUT_DIR, "phase-8-final-benchmark.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
