import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { StudyAttempt } from "@/lib/study/types";

const DATA_DIR = join(process.cwd(), "data", "study");
const DATA_FILE = join(DATA_DIR, "attempts.json");

declare global {
  var __agentproofStudyAttempts: StudyAttempt[] | undefined;
}

function ensureStore(): StudyAttempt[] {
  mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(DATA_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8")) as StudyAttempt[];
      if (Array.isArray(parsed)) {
        globalThis.__agentproofStudyAttempts = parsed;
        return globalThis.__agentproofStudyAttempts;
      }
    } catch {
      // fall through
    }
  }
  if (!globalThis.__agentproofStudyAttempts) {
    globalThis.__agentproofStudyAttempts = [];
  }
  return globalThis.__agentproofStudyAttempts;
}

function persist(rows: StudyAttempt[]): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2));
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

/** Internal only — never expose individual rows via public API. */
export function listStudyAttemptsInternal(): StudyAttempt[] {
  return [...ensureStore()];
}

export function clearStudyAttemptsForTests(): void {
  globalThis.__agentproofStudyAttempts = [];
  persist([]);
}
