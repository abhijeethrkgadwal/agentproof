import { randomUUID } from "crypto";
import { join } from "path";
import type { FeatureSnapshot } from "@/lib/features/types";
import { readJsonFile, writeJsonFile } from "@/lib/storage/ephemeralFile";

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
  if (!globalThis.__agentproofFeatureSnapshots) {
    const fromDisk = readJsonFile<StoredFeatureSnapshot[]>(DATA_FILE);
    globalThis.__agentproofFeatureSnapshots = Array.isArray(fromDisk)
      ? fromDisk
      : [];
  }
  return globalThis.__agentproofFeatureSnapshots;
}

function persist(rows: StoredFeatureSnapshot[]): void {
  writeJsonFile(DATA_FILE, rows);
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
