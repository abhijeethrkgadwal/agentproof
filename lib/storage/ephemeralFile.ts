import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { dirname } from "path";

/**
 * Vercel (and similar) filesystems are read-only except /tmp.
 * Demo telemetry stores must not crash request handlers on write failure.
 */
export function isEphemeralRuntime(): boolean {
  return (
    Boolean(process.env.VERCEL) ||
    process.env.AGENTPROOF_EPHEMERAL_STORE === "1"
  );
}

export function readJsonFile<T>(file: string): T | null {
  if (isEphemeralRuntime()) return null;
  try {
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Best-effort disk persist. Never throws — memory remains source of truth. */
export function writeJsonFile(file: string, data: unknown): void {
  if (isEphemeralRuntime()) return;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2));
  } catch {
    // Read-only FS / permission — ignore for serverless demos.
  }
}
