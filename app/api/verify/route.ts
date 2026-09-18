import { VerifyRequestSchema } from "@/lib/api/schemas";
import { clientKeyFromRequest, jsonError, jsonOk } from "@/lib/api/http";
import { validateSelectedObject } from "@/lib/challenge/validator";
import { calculateRisk } from "@/lib/risk/score";
import { ageMs, isExpired } from "@/lib/security/expiry";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { assertNotConsumed } from "@/lib/security/replay";
import { getSessionIdFromRequest } from "@/lib/security/session";
import { verifyChallengeToken } from "@/lib/security/signing";
import { getChallengeStore } from "@/lib/storage/challengeStore";
import { sanitizeTelemetry } from "@/lib/telemetry/sanitize";

export const runtime = "nodejs";

function minActiveMs(durationMs: number): number {
  const ratio = Number(process.env.AGENTPROOF_MIN_ACTIVE_RATIO ?? "0.85");
  return Math.floor(durationMs * Math.min(1, Math.max(0.5, ratio)));
}

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
  const sessionCookie = getSessionIdFromRequest(request);

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

  const sessionBound = sessionCookie === challenge.sessionId;
  if (!sessionBound) {
    return jsonError(403, "session_mismatch");
  }

  if (isExpired(challenge.expiresAt)) {
    return jsonError(410, "challenge_expired");
  }

  const replay = assertNotConsumed(store, challengeId);
  if (!replay.ok) {
    return jsonError(409, "replay");
  }

  if (challenge.lifecycle === "issued" || !challenge.startedAt) {
    return jsonError(409, "invalid_lifecycle", {
      expected: "active",
      actual: challenge.lifecycle,
    });
  }

  if (challenge.lifecycle === "submitted") {
    return jsonError(409, "replay");
  }

  const serverActiveMs = Date.now() - new Date(challenge.startedAt).getTime();
  const requiredActive = minActiveMs(challenge.renderConfiguration.durationMs);
  if (serverActiveMs < requiredActive) {
    return jsonError(425, "premature_submit", {
      serverActiveMs,
      requiredActiveMs: requiredActive,
    });
  }

  const answer = validateSelectedObject(challenge, selectedObjectId);
  const failedAttempts = challenge.failedAttempts;

  const riskInputs = {
    challengeSolved: answer.correct,
    completionTimeMs: telemetry.completionTimeMs ?? serverActiveMs,
    failedAttempts: answer.correct ? failedAttempts : failedAttempts + 1,
    retryCount: telemetry.retryCount ?? 0,
    interactionEventCount: telemetry.interactionEventCount ?? 0,
    challengeAgeMs: ageMs(challenge.issuedAt),
    expectedDurationMs: challenge.renderConfiguration.durationMs,
    serverActiveMs,
    framePollCount: challenge.framePollCount,
    sessionBound,
  };

  if (!answer.correct) {
    store.incrementFailedAttempts(challengeId);
    store.consumeChallenge(challengeId);

    const risk = calculateRisk({ ...riskInputs, challengeSolved: false });

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

  const risk = calculateRisk({ ...riskInputs, challengeSolved: true });

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
