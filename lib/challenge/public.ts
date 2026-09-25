import type {
  FrameResponse,
  PublicChallengeResponse,
  StoredChallenge,
} from "@/lib/challenge/types";
import { isTemporalChallenge } from "@/lib/challenge/types";
import { toDisplayPoses } from "@/lib/challenge/displayPose";
import {
  toDragAvoidFrame,
  toDragAvoidPublic,
} from "@/lib/challenge/drag-avoid";
import {
  toPhysicalFrame,
  toPhysicalPublic,
} from "@/lib/challenge/physical";
import {
  toDynamicPathFrame,
  toDynamicPathPublic,
} from "@/lib/challenge/dynamic-path";

/**
 * Issued payload: object identity only - never segments, starts, or
 * requiredDirectionChanges as a structured field (instruction text may still
 * state the human-facing task).
 */
export function toPublicChallenge(
  challenge: StoredChallenge,
  token: string,
): PublicChallengeResponse {
  switch (challenge.challengeType) {
    case "drag_avoid":
      return toDragAvoidPublic(challenge, token);
    case "physical":
      return toPhysicalPublic(challenge, token);
    case "dynamic_path":
      return toDynamicPathPublic(challenge, token);
    case "temporal":
    default:
      break;
  }

  if (!isTemporalChallenge(challenge)) {
    throw new Error(`unsupported_challenge_type:${challenge.challengeType}`);
  }

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

/**
 * Progressive frame response - display poses are quantized/jittered,
 * time-bucketed, and EMA-smoothed so they are not a clean invert of
 * internal segment math. Ground-truth math stays server-only.
 */
export function toFrameResponse(
  challenge: StoredChallenge,
  elapsedMs: number,
): FrameResponse {
  switch (challenge.challengeType) {
    case "drag_avoid":
      return toDragAvoidFrame(challenge, elapsedMs);
    case "physical":
      return toPhysicalFrame(challenge, elapsedMs);
    case "dynamic_path":
      return toDynamicPathFrame(challenge, elapsedMs);
    case "temporal":
    default:
      break;
  }

  if (!isTemporalChallenge(challenge)) {
    throw new Error(`unsupported_challenge_type:${challenge.challengeType}`);
  }

  const durationMs = challenge.renderConfiguration.durationMs;
  const display = toDisplayPoses(challenge, elapsedMs);
  return {
    challengeId: challenge.challengeId,
    lifecycle: challenge.lifecycle,
    elapsedMs: display.elapsedMs,
    durationMs,
    complete: elapsedMs >= durationMs,
    poses: display.poses,
    instruction: challenge.renderConfiguration.instruction,
  };
}

/** Guard helper for tests / audits - public JSON must not embed motion plans. */
export function publicPayloadLeaksMotion(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  if (text.includes('"segments"')) return true;
  if (text.includes('"velocity"')) return true;
  if (text.includes("correctObjectId")) return true;
  if (text.includes("groundTruth")) return true;
  if (text.includes("requiredDirectionChanges")) return true;
  if (text.includes("accessibleSafePath")) return true;
  if (text.includes("accessiblePlacementKey")) return true;
  if (text.includes("accessibleGateSlots")) return true;
  if (text.includes("openingCenterStart")) return true;
  if (text.includes("protectedBounds")) return true;
  return false;
}
