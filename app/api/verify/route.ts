import { VerifyRequestSchema } from "@/lib/api/schemas";
import { clientKeyFromRequest, jsonError, jsonOk } from "@/lib/api/http";
import { validateSelectedObject } from "@/lib/challenge/validator";
import { calculateRisk } from "@/lib/risk/score";
import { ageMs, isExpired } from "@/lib/security/expiry";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { assertNotConsumed } from "@/lib/security/replay";
import { verifyChallengeToken } from "@/lib/security/signing";
import { getChallengeStore } from "@/lib/storage/challengeStore";
import { sanitizeTelemetry } from "@/lib/telemetry/sanitize";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rate = checkRateLimit(`verify:${clientKeyFromRequest(request)}`);
  if (!rate.allowed) {
    return jsonError(429, "rate_limited", {
      retryAfterMs: rate.retryAfterMs,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "missing_or_invalid_fields", {
      reason: "invalid_json",
    });
  }

  const parsed = VerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "missing_or_invalid_fields", {
      issues: parsed.error.flatten(),
    });
  }

  const { challengeId, token, selectedObjectId } = parsed.data;
  const telemetry = sanitizeTelemetry(parsed.data.telemetry);

  const tokenResult = verifyChallengeToken(token);
  if (!tokenResult.ok) {
    return jsonError(401, tokenResult.error);
  }

  const payload = tokenResult.payload;
  if (payload.challengeId !== challengeId) {
    return jsonError(400, "challenge_id_mismatch");
  }

  const store = getChallengeStore();
  const challenge = store.getChallenge(challengeId);
  if (!challenge) {
    return jsonError(404, "challenge_not_found");
  }

  if (challenge.nonce !== payload.nonce || challenge.sessionId !== payload.sessionId) {
    return jsonError(401, "invalid_signature");
  }

  if (isExpired(challenge.expiresAt)) {
    return jsonError(410, "challenge_expired");
  }

  const replay = assertNotConsumed(store, challengeId);
  if (!replay.ok) {
    return jsonError(409, "replay");
  }

  const answer = validateSelectedObject(challenge, selectedObjectId);
  const failedAttempts = challenge.failedAttempts;

  if (!answer.correct) {
    store.incrementFailedAttempts(challengeId);
    // Consume on incorrect answer too? Spec says mark consumed after successful verification.
    // Incorrect answers should be rejected but challenge may still be usable until success/expiry.
    // For one-time security, consume on any verify attempt to prevent brute force.
    store.consumeChallenge(challengeId);

    const risk = calculateRisk({
      challengeSolved: false,
      completionTimeMs: telemetry.completionTimeMs ?? 0,
      failedAttempts: failedAttempts + 1,
      retryCount: telemetry.retryCount ?? 0,
      interactionEventCount: telemetry.interactionEventCount ?? 0,
      challengeAgeMs: ageMs(challenge.issuedAt),
      expectedDurationMs: challenge.renderConfiguration.durationMs,
    });

    return jsonOk({
      verified: false,
      decision: risk.decision,
      riskScore: risk.riskScore,
      confidence: risk.confidence,
      band: risk.band,
      challengeId,
      reason: answer.reason,
      factors: risk.factors,
    });
  }

  store.consumeChallenge(challengeId);

  const risk = calculateRisk({
    challengeSolved: true,
    completionTimeMs: telemetry.completionTimeMs ?? 0,
    failedAttempts,
    retryCount: telemetry.retryCount ?? 0,
    interactionEventCount: telemetry.interactionEventCount ?? 0,
    challengeAgeMs: ageMs(challenge.issuedAt),
    expectedDurationMs: challenge.renderConfiguration.durationMs,
  });

  return jsonOk({
    verified: true,
    decision: risk.decision,
    riskScore: risk.riskScore,
    confidence: risk.confidence,
    band: risk.band,
    challengeId,
    factors: risk.factors,
  });
}
