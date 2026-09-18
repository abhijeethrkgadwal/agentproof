import { CreateChallengeRequestSchema } from "@/lib/api/schemas";
import { clientKeyFromRequest, jsonError, jsonOk } from "@/lib/api/http";
import { generateTemporalChallenge } from "@/lib/challenge/generator";
import { toPublicChallenge } from "@/lib/challenge/public";
import { signChallengeToken } from "@/lib/security/signing";
import { checkRateLimit } from "@/lib/security/rateLimit";
import {
  createSessionId,
  sessionCookieHeader,
} from "@/lib/security/session";
import { getChallengeStore } from "@/lib/storage/challengeStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rate = checkRateLimit(`challenge:${clientKeyFromRequest(request)}`);
  if (!rate.allowed) {
    return jsonError(429, "rate_limited", {
      retryAfterMs: rate.retryAfterMs,
    });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = CreateChallengeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "missing_or_invalid_fields", {
      issues: parsed.error.flatten(),
    });
  }

  try {
    const store = getChallengeStore();
    store.purgeExpired();

    const sessionId = parsed.data.sessionId ?? createSessionId();
    const challenge = generateTemporalChallenge({
      difficulty: parsed.data.difficulty,
      sessionId,
    });

    store.createChallenge(challenge);

    const token = signChallengeToken({
      challengeId: challenge.challengeId,
      sessionId: challenge.sessionId,
      nonce: challenge.nonce,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
      difficulty: challenge.difficulty,
      challengeType: challenge.challengeType,
    });

    const response = jsonOk(toPublicChallenge(challenge, token));
    response.headers.set("Set-Cookie", sessionCookieHeader(challenge.sessionId));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_error";
    if (message.includes("AGENTPROOF_SIGNING_SECRET")) {
      return jsonError(500, "misconfigured_secret");
    }
    return jsonError(500, "challenge_generation_failed", { message });
  }
}
