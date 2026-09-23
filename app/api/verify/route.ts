import { VerifyRequestSchema } from "@/lib/api/schemas";
import { clientKeyFromRequest, jsonError, jsonOk } from "@/lib/api/http";
import { getChallengeDurationMs } from "@/lib/challenge/types";
import { validateChallengeAnswer } from "@/lib/challenge/validator";
import { getDecisionEngine } from "@/lib/decision/ruleEngine";
import { createFeatureSnapshot } from "@/lib/features/snapshot";
import { appendFeatureSnapshot } from "@/lib/features/store";
import { ageMs, isExpired } from "@/lib/security/expiry";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { assertNotConsumed } from "@/lib/security/replay";
import { resolveRequestSession } from "@/lib/security/session";
import { verifyChallengeToken } from "@/lib/security/signing";
import { getChallengeStore } from "@/lib/storage/challengeStore";
import { sanitizeTelemetry } from "@/lib/telemetry/sanitize";

export const runtime = "nodejs";

function minActiveMs(durationMs: number, challengeType: string): number {
  // Temporal keeps a long observation window. Natural challenges only need a
  // short anti-spam floor so finishing the goal (reach green / goal line)
  // can verify promptly without waiting out most of the timer.
  if (challengeType === "temporal") {
    const ratio = Math.min(
      1,
      Math.max(0.2, Number(process.env.AGENTPROOF_MIN_ACTIVE_RATIO ?? "0.85")),
    );
    return Math.floor(durationMs * ratio);
  }
  return Math.max(
    800,
    Number(process.env.AGENTPROOF_NATURAL_MIN_ACTIVE_MS ?? "1200"),
  );
}

export async function POST(request: Request) {
  const rate = await checkRateLimit(`verify:${clientKeyFromRequest(request)}`);
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

  const { challengeId, token, selectedObjectId, interaction } = parsed.data;
  const telemetry = sanitizeTelemetry(parsed.data.telemetry);

  const tokenResult = verifyChallengeToken(token);
  if (!tokenResult.ok) {
    return jsonError(401, tokenResult.error);
  }

  const payload = tokenResult.payload;
  if (payload.challengeId !== challengeId) {
    return jsonError(400, "challenge_id_mismatch");
  }

  const session = await resolveRequestSession(request);
  if (!session.ok) {
    return jsonError(403, session.error);
  }

  const store = getChallengeStore();
  const challenge = await store.getChallenge(challengeId);
  if (!challenge) {
    return jsonError(404, "challenge_not_found");
  }

  if (challenge.nonce !== payload.nonce || challenge.sessionId !== payload.sessionId) {
    return jsonError(401, "invalid_signature");
  }

  if (session.sessionId !== challenge.sessionId) {
    return jsonError(403, "session_mismatch");
  }

  if (isExpired(challenge.expiresAt)) {
    return jsonError(410, "challenge_expired");
  }

  const replay = await assertNotConsumed(store, challengeId);
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

  const durationMs = getChallengeDurationMs(challenge);
  const serverActiveMs = Date.now() - new Date(challenge.startedAt).getTime();
  const requiredActive = minActiveMs(durationMs, challenge.challengeType);
  if (serverActiveMs < requiredActive) {
    return jsonError(425, "premature_submit", {
      serverActiveMs,
      requiredActiveMs: requiredActive,
    });
  }

  // Ground-truth verification is COMPLETELY SEPARATE from risk scoring.
  const answer = validateChallengeAnswer(challenge, {
    selectedObjectId,
    interaction,
  });
  const failedAttempts = challenge.failedAttempts;

  const completionTimeMs = telemetry.completionTimeMs ?? serverActiveMs;
  const interactionEventCount = telemetry.interactionEventCount ?? 0;
  const retryCount = telemetry.retryCount ?? 0;
  const challengeAgeMs = ageMs(challenge.issuedAt);
  const frameCount = challenge.framePollCount;

  if (!answer.correct) {
    await store.incrementFailedAttempts(challengeId);
    await store.consumeChallenge(challengeId);

    const draft = createFeatureSnapshot({
      challengeType: challenge.challengeType,
      difficulty: challenge.difficulty,
      completionTimeMs,
      frameCount,
      apiRequestCount: frameCount + 2,
      interactionEventCount,
      retryCount: Math.max(retryCount, failedAttempts + 1),
      challengeAgeMs,
      verified: false,
      decision: "pending",
    });
    const engine = getDecisionEngine();
    const decision = engine.evaluate({ ...draft, verified: false });
    const snapshot = createFeatureSnapshot({
      ...draft,
      decision: decision.nextAction,
    });
    appendFeatureSnapshot(challengeId, snapshot);

    return jsonOk({
      verified: false,
      decision: decision.nextAction,
      riskScore: decision.riskScore,
      confidence: decision.confidence,
      band: decision.classification,
      challengeId,
      reason: answer.reason,
      factors: decision.factors,
    });
  }

  await store.consumeChallenge(challengeId);

  const draft = createFeatureSnapshot({
    challengeType: challenge.challengeType,
    difficulty: challenge.difficulty,
    completionTimeMs,
    frameCount,
    apiRequestCount: frameCount + 2,
    interactionEventCount,
    retryCount,
    challengeAgeMs,
    verified: true,
    decision: "pending",
  });
  const engine = getDecisionEngine();
  const decision = engine.evaluate({ ...draft, verified: true });
  const snapshot = createFeatureSnapshot({
    ...draft,
    decision: decision.nextAction,
  });
  appendFeatureSnapshot(challengeId, snapshot);

  return jsonOk({
    verified: true,
    decision: decision.nextAction,
    riskScore: decision.riskScore,
    confidence: decision.confidence,
    band: decision.classification,
    challengeId,
    factors: decision.factors,
  });
}
