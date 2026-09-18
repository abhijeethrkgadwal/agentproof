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
