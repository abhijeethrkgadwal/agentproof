import { createHmac, timingSafeEqual } from "crypto";
import { getSigningSecret } from "@/lib/config/env";

export type ChallengeTokenPayload = {
  challengeId: string;
  sessionId: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  difficulty: number;
  challengeType: string;
};

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function hmacSha256(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Sign challenge metadata into a compact token. */
export function signChallengeToken(
  payload: ChallengeTokenPayload,
  secret: string = getSigningSecret(),
): string {
  const body = encode(JSON.stringify(payload));
  const signature = hmacSha256(secret, body);
  return `${body}.${signature}`;
}

export type TokenVerificationResult =
  | { ok: true; payload: ChallengeTokenPayload }
  | { ok: false; error: string };

/** Verify HMAC signature and parse payload. Does not check expiry/replay. */
export function verifyChallengeToken(
  token: string,
  secret: string = getSigningSecret(),
): TokenVerificationResult {
  if (typeof token !== "string" || token.trim() === "") {
    return { ok: false, error: "malformed_token" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false, error: "malformed_token" };
  }

  const [body, signature] = parts;
  if (!body || !signature) {
    return { ok: false, error: "malformed_token" };
  }

  const expected = hmacSha256(secret, body);
  if (!safeEqual(signature, expected)) {
    return { ok: false, error: "invalid_signature" };
  }

  try {
    const parsed = JSON.parse(decode(body)) as ChallengeTokenPayload;
    if (
      !parsed.challengeId ||
      !parsed.sessionId ||
      !parsed.nonce ||
      !parsed.issuedAt ||
      !parsed.expiresAt ||
      typeof parsed.difficulty !== "number" ||
      !parsed.challengeType
    ) {
      return { ok: false, error: "malformed_token" };
    }
    return { ok: true, payload: parsed };
  } catch {
    return { ok: false, error: "malformed_token" };
  }
}
