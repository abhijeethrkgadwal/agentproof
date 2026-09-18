import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { FeatureSnapshot } from "@/lib/features/types";

const DATA_DIR = join(process.cwd(), "data", "feature-snapshots");
const DATA_FILE = join(DATA_DIR, "snapshots.json");

export type StoredFeatureSnapshot = FeatureSnapshot & {
  snapshotId: string;
  challengeId: string;
  createdAt: string;
};

declare global {
  var __agentproofFeatureSnapshots: StoredFeatureSnapshot[] | undefined;
}

function ensureStore(): StoredFeatureSnapshot[] {
  mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(DATA_FILE)) {
    try {
      const parsed = JSON.parse(
        readFileSync(DATA_FILE, "utf8"),
      ) as StoredFeatureSnapshot[];
      if (Array.isArray(parsed)) {
        globalThis.__agentproofFeatureSnapshots = parsed;
        return globalThis.__agentproofFeatureSnapshots;
      }
    } catch {
      // fall through
    }
  }
  if (!globalThis.__agentproofFeatureSnapshots) {
    globalThis.__agentproofFeatureSnapshots = [];
  }
  return globalThis.__agentproofFeatureSnapshots;
}

function persist(rows: StoredFeatureSnapshot[]): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2));
}

export function appendFeatureSnapshot(
  challengeId: string,
  snapshot: FeatureSnapshot,
): StoredFeatureSnapshot {
  const row: StoredFeatureSnapshot = {
    ...snapshot,
    snapshotId: randomUUID(),
    challengeId,
    createdAt: new Date().toISOString(),
  };
  const store = ensureStore();
  store.push(row);
  persist(store);
  return row;
}

export function listFeatureSnapshots(): StoredFeatureSnapshot[] {
  return [...ensureStore()].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}
