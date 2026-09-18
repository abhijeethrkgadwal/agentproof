import type {
  FrameResponse,
  PublicChallengeResponse,
  StoredChallenge,
} from "@/lib/challenge/types";
import { posesAtElapsed } from "@/lib/challenge/motion";

/**
 * Issued payload: object identity only — never segments, starts, or
 * requiredDirectionChanges as a structured field (instruction text may still
 * state the human-facing task).
 */
export function toPublicChallenge(
  challenge: StoredChallenge,
  token: string,
): PublicChallengeResponse {
  return {
    challengeId: challenge.challengeId,
    token,
    challengeType: challenge.challengeType,
    sessionId: challenge.sessionId,
    expiresAt: challenge.expiresAt,
    difficulty: challenge.difficulty,
    instruction: challenge.renderConfiguration.instruction,
    lifecycle: challenge.lifecycle,
    scene: {
      width: challenge.renderConfiguration.width,
      height: challenge.renderConfiguration.height,
      durationMs: challenge.renderConfiguration.durationMs,
      objects: challenge.renderConfiguration.objects.map((object) => ({
        id: object.id,
        shape: object.shape,
        color: object.color,
        size: object.size,
      })),
    },
  };
}

export function toFrameResponse(
  challenge: StoredChallenge,
  elapsedMs: number,
): FrameResponse {
  const durationMs = challenge.renderConfiguration.durationMs;
  const capped = Math.max(0, Math.min(elapsedMs, durationMs));
  return {
    challengeId: challenge.challengeId,
    lifecycle: challenge.lifecycle,
    elapsedMs: capped,
    durationMs,
    complete: capped >= durationMs,
    poses: posesAtElapsed(challenge, capped),
    instruction: challenge.renderConfiguration.instruction,
  };
}

/** Guard helper for tests / audits — public JSON must not embed motion plans. */
export function publicPayloadLeaksMotion(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  if (text.includes('"segments"')) return true;
  if (text.includes('"velocity"')) return true;
  if (text.includes("correctObjectId")) return true;
  if (text.includes("groundTruth")) return true;
  if (text.includes("requiredDirectionChanges")) return true;
  return false;
}
