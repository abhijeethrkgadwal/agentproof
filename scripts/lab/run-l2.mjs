/**
 * Level 2 — Playwright browser automation against /demo.
 * Observes progressive frame API responses while driving Start/Verify UI.
 */
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const BASE = process.env.AGENTPROOF_BASE_URL ?? "http://127.0.0.1:43123";
const COUNT = Number(process.env.LAB_L2_COUNT ?? "3");
const DATA_FILE = join(process.cwd(), "data", "lab-runs", "runs.json");
const THRESHOLD = Math.PI / 6;

function computeAutomationCost(input) {
  return Number(
    (
      input.timeToSolveMs / 1000 +
      input.actions * 0.5 +
      input.framesObserved * 0.1 +
      (input.apiCalls ?? 0) * 0.05
    ).toFixed(3),
  );
}

function loadRuns() {
  if (!existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveRun(run) {
  mkdirSync(join(process.cwd(), "data", "lab-runs"), { recursive: true });
  const runs = loadRuns();
  runs.push(run);
  writeFileSync(DATA_FILE, JSON.stringify(runs, null, 2));
}

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

async function oneRun(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const t0 = Date.now();
  let apiCalls = 0;
  let framesObserved = 0;
  let actions = 0;
  let challengeId;
  let instruction = "";
  let durationMs = 5000;
  const trails = {};

  page.on("response", async (response) => {
    try {
      const url = response.url();
      if (!url.includes("/api/challenge") || response.request().method() !== "POST") {
        if (url.includes("/api/verify")) apiCalls += 1;
        return;
      }
      apiCalls += 1;
      const json = await response.json();
      if (url.includes("/frame")) {
        framesObserved += 1;
        for (const pose of json.poses ?? []) {
          if (!trails[pose.id]) trails[pose.id] = [];
          trails[pose.id].push({
            t: json.elapsedMs ?? 0,
            x: pose.x,
            y: pose.y,
          });
        }
      } else if (!url.includes("/start")) {
        challengeId = json.challengeId;
        instruction = json.instruction ?? "";
        durationMs = json.scene?.durationMs ?? 5000;
      }
    } catch {
      // ignore parse races
    }
  });

  await page.goto(`${BASE}/demo/temporal`);
  await page.getByTestId("start-challenge").click();
  actions += 1;
  await page.waitForTimeout(durationMs + 500);

  const requiredMatch = instruction.match(/exactly\s+(\d+)\s+time/i);
  const required = requiredMatch ? Number(requiredMatch[1]) : 2;
  const counts = Object.fromEntries(
    Object.entries(trails).map(([id, samples]) => [id, countChanges(samples)]),
  );
  const matches = Object.entries(counts).filter(([, c]) => c === required);
  let selected =
    matches.sort((a, b) => (trails[b[0]]?.length ?? 0) - (trails[a[0]]?.length ?? 0))[0]?.[0] ??
    Object.keys(counts).sort(
      (a, b) => Math.abs(counts[a] - required) - Math.abs(counts[b] - required),
    )[0] ??
    "object_1";

  const canvas = page.getByTestId("temporal-canvas");
  const box = await canvas.boundingBox();
  const last = trails[selected]?.[trails[selected].length - 1];
  if (box && last) {
    const scaleX = box.width / 640;
    const scaleY = box.height / 360;
    await page.mouse.click(box.x + last.x * scaleX, box.y + last.y * scaleY);
    actions += 1;
  } else if (box) {
    // Fallback: probe canvas center — still counts as an automation attempt
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    actions += 1;
  }

  const verify = page.getByTestId("verify-button");
  const enabled = await verify.isEnabled().catch(() => false);
  if (enabled) {
    await verify.click();
    actions += 1;
  }

  let success = false;
  try {
    await page.getByTestId("verify-status").waitFor({ timeout: 8000 });
    const text = await page.getByTestId("verify-status").textContent();
    success = (text ?? "").includes("Verified");
  } catch {
    success = false;
  }

  const timeToSolveMs = Date.now() - t0;
  const run = {
    runId: randomUUID(),
    level: "l2_browser",
    difficulty: 1,
    challengeId,
    status: success ? "success" : "failure",
    success,
    timeToSolveMs,
    apiCalls,
    framesObserved,
    actions,
    automationCost: computeAutomationCost({
      timeToSolveMs,
      actions,
      framesObserved,
      apiCalls,
    }),
    verificationResult: { verified: success },
    notes: `selected=${selected}; required=${required}; counts=${JSON.stringify(counts)}; verifyEnabled=${enabled}`,
    createdAt: new Date().toISOString(),
  };
  saveRun(run);
  await context.close();
  return run;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (let i = 0; i < COUNT; i += 1) {
    console.log(`L2 run ${i + 1}/${COUNT}`);
    results.push(await oneRun(browser));
  }
  await browser.close();
  const ok = results.filter((r) => r.success).length;
  console.log(`L2 done: ${ok}/${results.length} success`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
