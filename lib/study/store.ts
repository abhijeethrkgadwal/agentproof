import { randomUUID } from "crypto";
import { join } from "path";
import type { StudyAttempt } from "@/lib/study/types";
import { readJsonFile, writeJsonFile } from "@/lib/storage/ephemeralFile";

const DATA_DIR = join(process.cwd(), "data", "study");
const DATA_FILE = join(DATA_DIR, "attempts.json");

declare global {
  var __agentproofStudyAttempts: StudyAttempt[] | undefined;
}

function ensureStore(): StudyAttempt[] {
  if (!globalThis.__agentproofStudyAttempts) {
    const fromDisk = readJsonFile<StudyAttempt[]>(DATA_FILE);
    globalThis.__agentproofStudyAttempts = Array.isArray(fromDisk)
      ? fromDisk
      : [];
  }
  return globalThis.__agentproofStudyAttempts;
}

function persist(rows: StudyAttempt[]): void {
  writeJsonFile(DATA_FILE, rows);
}

export function appendStudyAttempt(
  partial: Omit<StudyAttempt, "attemptId" | "timestamp"> & {
    timestamp?: string;
  },
): StudyAttempt {
  const row: StudyAttempt = {
    ...partial,
    attemptId: randomUUID(),
    timestamp: partial.timestamp ?? new Date().toISOString(),
  };
  const store = ensureStore();
  store.push(row);
  persist(store);
  return row;
}

/** Internal only - never expose individual rows via public API. */
export function listStudyAttemptsInternal(): StudyAttempt[] {
  return [...ensureStore()];
}

export function clearStudyAttemptsForTests(): void {
  globalThis.__agentproofStudyAttempts = [];
  persist([]);
}
