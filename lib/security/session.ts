import { randomBytes } from "crypto";

export const SESSION_COOKIE = "agentproof_sid";

export function createSessionId(): string {
  return randomBytes(16).toString("hex");
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

export function getSessionIdFromRequest(request: Request): string | undefined {
  return parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
}

/** Short-lived HttpOnly session cookie bound to the challenge session. */
export function sessionCookieHeader(sessionId: string, maxAgeSec = 120): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
