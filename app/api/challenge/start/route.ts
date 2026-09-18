import { z } from "zod";
import { clientKeyFromRequest, jsonError, jsonOk } from "@/lib/api/http";
import { assertLifecycle } from "@/lib/challenge/motion";
import { toFrameResponse } from "@/lib/challenge/public";
import { isExpired } from "@/lib/security/expiry";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { resolveRequestSession } from "@/lib/security/session";
import { verifyChallengeToken } from "@/lib/security/signing";
import { getChallengeStore } from "@/lib/storage/challengeStore";

export const runtime = "nodejs";

const StartSchema = z.object({
  challengeId: z.string().uuid(),
  token: z.string().min(1),
});

export async function POST(request: Request) {
  const rate = await checkRateLimit(`start:${clientKeyFromRequest(request)}`);
  if (!rate.allowed) {
    return jsonError(429, "rate_limited", { retryAfterMs: rate.retryAfterMs });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "missing_or_invalid_fields", { reason: "invalid_json" });
  }

  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "missing_or_invalid_fields", {
      issues: parsed.error.flatten(),
    });
  }

  const tokenResult = verifyChallengeToken(parsed.data.token);
  if (!tokenResult.ok) {
    return jsonError(401, tokenResult.error);
  }
  if (tokenResult.payload.challengeId !== parsed.data.challengeId) {
    return jsonError(400, "challenge_id_mismatch");
  }

  const session = await resolveRequestSession(request);
  if (!session.ok) {
    return jsonError(403, session.error);
  }

  const store = getChallengeStore();
  const challenge = await store.getChallenge(parsed.data.challengeId);
  if (!challenge) {
    return jsonError(404, "challenge_not_found");
  }

  if (
    challenge.nonce !== tokenResult.payload.nonce ||
    challenge.sessionId !== tokenResult.payload.sessionId
  ) {
    return jsonError(401, "invalid_signature");
  }

  if (session.sessionId !== challenge.sessionId) {
    return jsonError(403, "session_mismatch");
  }

  if (isExpired(challenge.expiresAt)) {
    return jsonError(410, "challenge_expired");
  }

  if (challenge.consumed) {
    return jsonError(409, "replay");
  }

  const life = assertLifecycle(challenge.lifecycle, ["issued", "started", "active"]);
  if (!life.ok) {
    return jsonError(409, life.error);
  }

  const now = new Date();
  const startedAt = challenge.startedAt ?? now.toISOString();
  let updated = await store.updateChallenge(challenge.challengeId, {
    lifecycle: "active",
    startedAt,
  });

  if (!updated?.startedAt) {
    return jsonError(500, "start_failed");
  }

  const frame = toFrameResponse(updated, 0);
  updated = (await store.updateChallenge(challenge.challengeId, {
    lastDisplayPoses: frame.poses,
    lastDisplayElapsedMs: frame.elapsedMs,
  }))!;

  return jsonOk(frame);
}
