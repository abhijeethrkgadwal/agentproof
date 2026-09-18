import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { getSigningSecret } from "@/lib/config/env";

export const SESSION_COOKIE = "agentproof_sid";

export type SessionRecord = {
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
  environment?: "test" | "live";
  projectId?: string;
};

export interface SessionStore {
  put(record: SessionRecord): Promise<void> | void;
  get(sessionId: string): Promise<SessionRecord | undefined> | SessionRecord | undefined;
  delete(sessionId: string): Promise<void> | void;
  clear(): Promise<void> | void;
}

export class InMemorySessionStore implements SessionStore {
  private readonly map = new Map<string, SessionRecord>();

  put(record: SessionRecord): void {
    this.map.set(record.sessionId, record);
  }

  get(sessionId: string): SessionRecord | undefined {
    const found = this.map.get(sessionId);
    if (!found) return undefined;
    if (found.expiresAt < Date.now()) {
      this.map.delete(sessionId);
      return undefined;
    }
    return found;
  }

  delete(sessionId: string): void {
    this.map.delete(sessionId);
  }

  clear(): void {
    this.map.clear();
  }
}

declare global {
  var __agentproofSessionStore: SessionStore | undefined;
}

export function getSessionStore(): SessionStore {
  if (!globalThis.__agentproofSessionStore) {
    globalThis.__agentproofSessionStore = new InMemorySessionStore();
  }
  return globalThis.__agentproofSessionStore;
}

export function setSessionStoreForTests(store: SessionStore | null): void {
  globalThis.__agentproofSessionStore = store ?? undefined;
}

export function getSessionTtlMs(): number {
  const raw = Number(process.env.AGENTPROOF_SESSION_TTL_MS ?? "120000");
  return Number.isFinite(raw) && raw >= 10_000 ? raw : 120_000;
}

/** @deprecated use getSessionTtlMs */
export function getSessionTtlMsFromEnv(): number {
  return getSessionTtlMs();
}

/** Create a short-lived session and return a signed cookie value. */
export async function issueSignedSession(options?: {
  environment?: "test" | "live";
  projectId?: string;
}): Promise<{ sessionId: string; cookieValue: string; expiresAt: number }> {
  const sessionId = randomBytes(16).toString("hex");
  const now = Date.now();
  const expiresAt = now + getSessionTtlMs();
  const record: SessionRecord = {
    sessionId,
    issuedAt: now,
    expiresAt,
    environment: options?.environment,
    projectId: options?.projectId,
  };
  await getSessionStore().put(record);
  return {
    sessionId,
    cookieValue: signSessionToken(sessionId, expiresAt),
    expiresAt,
  };
}

export function signSessionToken(sessionId: string, expiresAt: number): string {
  const payload = Buffer.from(
    JSON.stringify({ sid: sessionId, exp: expiresAt }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(
  token: string,
): { ok: true; sessionId: string; expiresAt: number } | { ok: false; error: string } {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "invalid_session_format" };
  const [payload, sig] = parts as [string, string];
  const expected = createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "invalid_session_signature" };
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { sid?: string; exp?: number };
    if (!parsed.sid || typeof parsed.exp !== "number") {
      return { ok: false, error: "invalid_session_payload" };
    }
    if (parsed.exp < Date.now()) {
      return { ok: false, error: "session_expired" };
    }
    return { ok: true, sessionId: parsed.sid, expiresAt: parsed.exp };
  } catch {
    return { ok: false, error: "invalid_session_payload" };
  }
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

/**
 * Resolve and validate the signed session from the request cookie.
 * Rejects tampered / expired cookies. Optionally checks SessionStore presence.
 */
export async function resolveRequestSession(
  request: Request,
): Promise<
  | { ok: true; sessionId: string; expiresAt: number }
  | { ok: false; error: string }
> {
  const raw = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (!raw) return { ok: false, error: "session_missing" };

  // Backward-compat: plain hex session ids from Phase 3–6 still accepted if
  // they exist in the store (dev migration). Prefer signed tokens.
  if (/^[a-f0-9]{32}$/i.test(raw)) {
    const stored = await getSessionStore().get(raw);
    if (!stored) return { ok: false, error: "session_unknown" };
    return { ok: true, sessionId: raw, expiresAt: stored.expiresAt };
  }

  const verified = verifySessionToken(raw);
  if (!verified.ok) return verified;
  const stored = await getSessionStore().get(verified.sessionId);
  if (!stored) return { ok: false, error: "session_unknown" };
  return {
    ok: true,
    sessionId: verified.sessionId,
    expiresAt: verified.expiresAt,
  };
}

/** @deprecated Prefer resolveRequestSession — returns raw cookie only. */
export function getSessionIdFromRequest(request: Request): string | undefined {
  const raw = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (!raw) return undefined;
  if (/^[a-f0-9]{32}$/i.test(raw)) return raw;
  const verified = verifySessionToken(raw);
  return verified.ok ? verified.sessionId : undefined;
}

export function sessionCookieHeader(
  cookieValue: string,
  maxAgeSec?: number,
): string {
  const ttl = maxAgeSec ?? Math.floor(getSessionTtlMs() / 1000);
  return `${SESSION_COOKIE}=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttl}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Legacy helper kept for tests that only need an id. */
export function createSessionId(): string {
  return randomBytes(16).toString("hex");
}
