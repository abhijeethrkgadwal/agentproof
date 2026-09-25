import { randomUUID } from "crypto";
import { join } from "path";
import type { AttackerLevel, BenchmarkRow, LabRunRecord } from "@/lib/lab/types";
import { median, p95, successRate } from "@/lib/lab/metrics";
import { readJsonFile, writeJsonFile } from "@/lib/storage/ephemeralFile";

const DATA_DIR = join(process.cwd(), "data", "lab-runs");
const DATA_FILE = join(DATA_DIR, "runs.json");

declare global {
  var __agentproofLabRuns: LabRunRecord[] | undefined;
}

function ensureStore(): LabRunRecord[] {
  if (!globalThis.__agentproofLabRuns) {
    const fromDisk = readJsonFile<LabRunRecord[]>(DATA_FILE);
    globalThis.__agentproofLabRuns = Array.isArray(fromDisk) ? fromDisk : [];
  }
  return globalThis.__agentproofLabRuns;
}

function persist(runs: LabRunRecord[]): void {
  writeJsonFile(DATA_FILE, runs);
}

export function listLabRuns(): LabRunRecord[] {
  return [...ensureStore()].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}

export function appendLabRun(
  partial: Omit<LabRunRecord, "runId" | "createdAt">,
): LabRunRecord {
  const run: LabRunRecord = {
    ...partial,
    runId: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const store = ensureStore();
  store.push(run);
  persist(store);
  return run;
}

export function clearLabRuns(): void {
  globalThis.__agentproofLabRuns = [];
  persist([]);
}

export function benchmarkByLevel(
  levels: AttackerLevel[] = [
    "human",
    "human_study",
    "l1_api_observer",
    "l2_browser",
    "l3_vision",
    "lab_v2",
  ],
): BenchmarkRow[] {
  const runs = ensureStore();
  return levels.map((level) => {
    const subset = runs.filter((r) => r.level === level);
    // Prefer success-only medians; if none, fall back to all attempts for cost visibility
    const successes = subset.filter((r) => r.success);
    const pool = successes.length > 0 ? successes : subset;
    const times = pool.map((r) => r.timeToSolveMs);
    const frames = pool.map((r) => r.framesObserved);
    const apis = pool.map((r) => r.apiCalls);
    const actions = pool.map((r) => r.actions);
    const costs = pool.map((r) => r.automationCost);
    return {
      level,
      runs: subset.length,
      successRate: successRate(successes.length, subset.length),
      medianSolveMs: median(times),
      p95SolveMs: p95(times),
      medianFrames: median(frames),
      medianApiCalls: median(apis),
      medianActions: median(actions),
      medianAutomationCost: median(costs),
    };
  });
}
