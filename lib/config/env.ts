/**
 * Environment configuration. Missing required secrets fail fast.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

export function getSigningSecret(): string {
  return requireEnv("AGENTPROOF_SIGNING_SECRET");
}

export function getChallengeTtlMs(): number {
  const raw = process.env.AGENTPROOF_CHALLENGE_TTL_MS;
  if (!raw) return 60_000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("AGENTPROOF_CHALLENGE_TTL_MS must be a positive number");
  }
  return parsed;
}

export function getRateLimitWindowMs(): number {
  return Number(process.env.AGENTPROOF_RATE_LIMIT_WINDOW_MS ?? 60_000);
}

export function getRateLimitMaxRequests(): number {
  return Number(process.env.AGENTPROOF_RATE_LIMIT_MAX ?? 60);
}

/** memory (default) | redis */
export function getStorageBackend(): "memory" | "redis" {
  const raw = (process.env.AGENTPROOF_STORAGE_BACKEND ?? "memory").toLowerCase();
  return raw === "redis" ? "redis" : "memory";
}

export function getRedisUrl(): string | undefined {
  const url = process.env.AGENTPROOF_REDIS_URL ?? process.env.REDIS_URL;
  return url && url.trim() ? url.trim() : undefined;
}

export function getSessionTtlMs(): number {
  const raw = Number(process.env.AGENTPROOF_SESSION_TTL_MS ?? "120000");
  return Number.isFinite(raw) && raw >= 10_000 ? raw : 120_000;
}
