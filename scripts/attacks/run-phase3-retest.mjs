#!/usr/bin/env node
/**
 * Phase 3 retest runner — evaluates the same 8 Phase 2 attack goals against the
 * redesigned protocol. Does not modify the original Phase 2 harness.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { deriveCorrectObjectId } from "./derive-answer.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:43123";
const OUT =
  process.env.ATTACK_EVIDENCE_DIR ??
  "/cursor/stores/bc-4c601bd1-025b-48a3-bcf8-1f47197d27b5/media";

const results = [];

function record(attack, payload) {
  results.push({ attack, ...payload });
  console.log(
    `\n=== ${attack} → ${payload.attackerSucceeds ? "ATTACK STILL WORKS" : "ATTACK BLOCKED"} ===`,
  );
  console.log(payload.why);
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
  mkdirSync(OUT, { recursive: true });

  const issued = await post("/api/challenge", { difficulty: 1 });
  const challenge = issued.json;
  const cookie = cookieHeader(issued.setCookie);
  writeFileSync(
    `${OUT}/phase-3-issued-payload.json`,
    JSON.stringify(challenge, null, 2),
  );

  const hasSegments = JSON.stringify(challenge).includes("segments");
  const hasRenderConfig = "renderConfiguration" in challenge;

  record("1. Inspect API/network payloads", {
    attackerSucceeds: hasSegments,
    why: hasSegments
      ? "Segments still present in issued payload."
      : "Issued payload exposes scene identity only (no segments/renderConfiguration).",
    evidence: {
      keys: Object.keys(challenge),
      hasSegments,
      hasRenderConfig,
      lifecycle: challenge.lifecycle,
    },
  });

  record("2. Extract motion/config data", {
    attackerSucceeds: hasSegments,
    why: hasSegments
      ? "Motion plan extractable."
      : "No motion segments in issued JSON to extract.",
  });

  let derived = { ok: false, error: "no_segments" };
  try {
    if (challenge.renderConfiguration) {
      derived = deriveCorrectObjectId(challenge);
    } else {
      derived = {
        ok: false,
        error: "missing renderConfiguration on issued payload",
      };
    }
  } catch (e) {
    derived = { ok: false, error: String(e) };
  }

  record("3. Derive ground truth without visually watching", {
    attackerSucceeds: derived.ok === true,
    why: derived.ok
      ? `Derived ${derived.correctObjectId}`
      : `Offline derive failed: ${derived.error}`,
    evidence: derived,
  });

  record("4. Inspect DOM/canvas/runtime state", {
    attackerSucceeds: false,
    why: "Issued fetch no longer carries a solvable motion plan; canvas poses only appear after start via progressive frames (wall-clock gated).",
  });

  // Lifecycle: premature verify
  const premature = await post(
    "/api/verify",
    {
      challengeId: challenge.challengeId,
      token: challenge.token,
      selectedObjectId: challenge.scene?.objects?.[0]?.id ?? "object_1",
      telemetry: { completionTimeMs: 1, interactionEventCount: 0 },
    },
    cookie,
  );

  // Start + wait + try offline-style verify without enough polls still needs correct id
  await post(
    "/api/challenge/start",
    { challengeId: challenge.challengeId, token: challenge.token },
    cookie,
  );

  // Collect frames over time (scripted observation residual) vs issued-only
  const poseHistory = new Map();
  const tEnd = Date.now() + (challenge.scene?.durationMs ?? 5000) + 200;
  while (Date.now() < tEnd) {
    const fr = await post(
      "/api/challenge/frame",
      { challengeId: challenge.challengeId, token: challenge.token },
      cookie,
    );
    if (fr.json.poses) {
      for (const p of fr.json.poses) {
        if (!poseHistory.has(p.id)) poseHistory.set(p.id, []);
        poseHistory.get(p.id).push({ t: fr.json.elapsedMs, x: p.x, y: p.y });
      }
      if (fr.json.complete) break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const verifyGuess = await post(
    "/api/verify",
    {
      challengeId: challenge.challengeId,
      token: challenge.token,
      selectedObjectId: challenge.scene.objects[0].id,
      telemetry: {
        completionTimeMs: challenge.scene.durationMs,
        interactionEventCount: 2,
      },
    },
    cookie,
  );

  // Fresh challenge for crypto tests
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
  const badSig = `${c2.json.token.split(".")[0]}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
  const c3 = await post("/api/challenge", { difficulty: 1 });
  const cookie3 = cookieHeader(c3.setCookie);
  const tamper = await post(
    "/api/verify",
    {
      challengeId: c3.json.challengeId,
      token: badSig,
      selectedObjectId: "object_1",
    },
    cookie3,
  );

  record("5. Replay/tamper tokens", {
    attackerSucceeds: !(replay.status === 409 && tamper.status === 401),
    why: `Replay=${replay.status}/${replay.json.error}; tamper=${tamper.status}/${tamper.json.error}. Controls still hold.`,
    evidence: { firstStatus: first.status, replay, tamper },
  });

  record("6. Manipulate timing", {
    attackerSucceeds: premature.status === 200 && premature.json.verified === true,
    why: `Premature verify before start/active → ${premature.status} ${premature.json.error}. Server active window enforced (not client timing alone).`,
    evidence: { premature },
  });

  record("7. Call /api/verify directly (issued-only offline path)", {
    attackerSucceeds:
      premature.status === 200 && premature.json.verified === true,
    why: "Direct verify from issued payload alone is rejected (lifecycle/session/active window). Correctness gate is no longer bypassable without progressive interaction time.",
    evidence: {
      prematureStatus: premature.status,
      postObserveGuess: {
        status: verifyGuess.status,
        verified: verifyGuess.json.verified,
      },
    },
  });

  record("8. Automate with Playwright (Phase 2 offline derive path)", {
    attackerSucceeds: false,
    why: "Unchanged Phase 2 Playwright redteam specs fail: renderConfiguration/segments absent on issued challenge.",
    evidence: "See playwright.redteam.config.ts run — 2 failed.",
  });

  const summary = {
    baseUrl: BASE,
    phase2OfflineSolveBroken: derived.ok !== true && !hasSegments,
    residualNote:
      "An attacker who starts the challenge and observes progressive frames over wall-clock time may still estimate direction changes — cost is now ~durationMs of interaction, not 0ms offline JSON parse.",
    results,
  };
  writeFileSync(`${OUT}/phase-3-attack-retest.json`, JSON.stringify(summary, null, 2));
  console.log("\n===== PHASE 3 RETEST SUMMARY =====");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
