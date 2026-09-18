import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { AttackRunRecord } from "@/lib/lab/types";

const DATA_DIR = join(process.cwd(), "data", "lab-runs");
const DATA_FILE = join(DATA_DIR, "attack-runs.json");

declare global {
  var __agentproofAttackRuns: AttackRunRecord[] | undefined;
}

function ensureStore(): AttackRunRecord[] {
  mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(DATA_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8")) as AttackRunRecord[];
      if (Array.isArray(parsed)) {
        globalThis.__agentproofAttackRuns = parsed;
        return globalThis.__agentproofAttackRuns;
      }
    } catch {
      // fall through
    }
  }
  if (!globalThis.__agentproofAttackRuns) {
    globalThis.__agentproofAttackRuns = [];
  }
  return globalThis.__agentproofAttackRuns;
}

function persist(rows: AttackRunRecord[]): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2));
}

export function appendAttackRun(
  partial: Omit<AttackRunRecord, "runId" | "timestamp"> & {
    timestamp?: string;
  },
): AttackRunRecord {
  const row: AttackRunRecord = {
    ...partial,
    runId: randomUUID(),
    timestamp: partial.timestamp ?? new Date().toISOString(),
  };
  const store = ensureStore();
  store.push(row);
  persist(store);
  return row;
}

export function listAttackRuns(): AttackRunRecord[] {
  return [...ensureStore()].sort((a, b) =>
    a.timestamp < b.timestamp ? 1 : -1,
  );
}

export function clearAttackRunsForTests(): void {
  globalThis.__agentproofAttackRuns = [];
  persist([]);
}

export function summarizeAttackRuns(runs: AttackRunRecord[] = listAttackRuns()) {
  const byName = new Map<string, AttackRunRecord[]>();
  for (const run of runs) {
    const list = byName.get(run.attackName) ?? [];
    list.push(run);
    byName.set(run.attackName, list);
  }
  return [...byName.entries()].map(([attackName, subset]) => {
    const ok = subset.filter((r) => r.success).length;
    return {
      attackName,
      n: subset.length,
      successRate: subset.length ? ok / subset.length : 0,
      successes: ok,
    };
  });
}
