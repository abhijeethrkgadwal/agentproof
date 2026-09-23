import type { InteractionPayload, AnswerValidation } from "@/lib/challenge/core/types";
import {
  normalizeTrajectorySamples,
  trajectoryWithinSpeed,
} from "@/lib/challenge/core/trajectory";
import { segmentPositionAt } from "@/lib/challenge/motion";
import type {
  DynamicPathGroundTruth,
  DynamicPathRenderConfiguration,
  FrameResponse,
  ObjectPose,
  PublicChallengeResponse,
  StoredChallenge,
} from "@/lib/challenge/types";
import { isDynamicPathChallenge } from "@/lib/challenge/types";

function cfg(challenge: StoredChallenge): DynamicPathRenderConfiguration {
  if (!isDynamicPathChallenge(challenge)) throw new Error("not_dynamic_path");
  return challenge.renderConfiguration;
}

function gt(challenge: StoredChallenge): DynamicPathGroundTruth {
  if (!isDynamicPathChallenge(challenge)) throw new Error("not_dynamic_path");
  return challenge.groundTruth;
}

export function gateOpeningCenter(
  challenge: StoredChallenge,
  gateId: string,
  elapsedMs: number,
): number {
  const c = cfg(challenge);
  const gate = c.gates.find((g) => g.id === gateId);
  if (!gate) return c.height / 2;
  const pos = segmentPositionAt(
    { x: gate.x, y: gate.openingCenterStart },
    gate.segments,
    elapsedMs,
  );
  const half = gate.openingHeight / 2;
  return Math.min(c.height - half - 10, Math.max(half + 10, pos.y));
}

export function toDynamicPathPublic(
  challenge: StoredChallenge,
  token: string,
): PublicChallengeResponse {
  const c = cfg(challenge);
  return {
    challengeId: challenge.challengeId,
    token,
    challengeType: "dynamic_path",
    sessionId: challenge.sessionId,
    expiresAt: challenge.expiresAt,
    difficulty: challenge.difficulty,
    instruction: c.instruction,
    lifecycle: challenge.lifecycle,
    scene: {
      width: c.width,
      height: c.height,
      durationMs: c.durationMs,
      objects: [
        {
          id: c.ball.id,
          shape: "circle",
          color: c.ball.color,
          size: c.ball.size,
        },
        ...c.gates.map((g) => ({
          id: g.id,
          shape: "square" as const,
          color: "#94a3b8",
          size: g.gateThickness,
        })),
      ],
      layout: {
        ballStart: c.ball.start,
        goalX: c.goalX,
        gates: c.gates.map((g) => ({
          id: g.id,
          x: g.x,
          openingHeight: g.openingHeight,
          gateThickness: g.gateThickness,
          // no openingCenterStart / segments
        })),
      },
    },
    accessibilityHint:
      "Accessible mode: discrete nudges with live opening announcements. Pilot only — not WCAG-certified.",
  };
}

export function toDynamicPathFrame(
  challenge: StoredChallenge,
  elapsedMs: number,
): FrameResponse {
  const c = cfg(challenge);
  const cycle = c.durationMs > 0 ? elapsedMs % c.durationMs : 0;
  const t = Math.max(0, Math.min(cycle, c.durationMs));
  const poses: ObjectPose[] = [
    {
      id: c.ball.id,
      shape: "circle",
      color: c.ball.color,
      size: c.ball.size,
      x: c.ball.start.x,
      y: c.ball.start.y,
      role: "ball",
    },
  ];

  for (const gate of c.gates) {
    const center = gateOpeningCenter(challenge, gate.id, t);
    poses.push({
      id: `${gate.id}_opening`,
      shape: "square",
      color: "#22d3ee",
      size: gate.openingHeight / 2,
      x: gate.x,
      y: center,
      role: "opening",
    });
    poses.push({
      id: `${gate.id}_wall`,
      shape: "square",
      color: "#64748b",
      size: gate.gateThickness,
      x: gate.x,
      y: c.height / 2,
      role: "gate",
    });
  }

  return {
    challengeId: challenge.challengeId,
    lifecycle: challenge.lifecycle,
    elapsedMs: Math.min(elapsedMs, c.durationMs),
    durationMs: c.durationMs,
    complete: elapsedMs >= c.durationMs,
    poses,
    instruction: c.instruction,
  };
}

export function validateDynamicPath(
  challenge: StoredChallenge,
  input: {
    selectedObjectId?: string;
    interaction?: InteractionPayload;
  },
): AnswerValidation {
  const c = cfg(challenge);
  const truth = gt(challenge);

  if (
    input.interaction?.accessibleAnswers &&
    (!input.interaction.samples || input.interaction.samples.length < 3)
  ) {
    return { correct: false, reason: "invalid_accessible_answer" };
  }

  const samples = normalizeTrajectorySamples(
    (input.interaction?.samples ?? []).filter(
      (s) => !s.objectId || s.objectId === truth.ballId,
    ),
  );
  if (samples.length < 3) {
    return { correct: false, reason: "invalid_trajectory" };
  }

  const first = samples[0]!;
  if (Math.hypot(first.x - c.ball.start.x, first.y - c.ball.start.y) > 70) {
    return { correct: false, reason: "invalid_start" };
  }

  if (!trajectoryWithinSpeed(samples, Math.max(1600, truth.maxSpeedPxPerSec * 4))) {
    return { correct: false, reason: "invalid_trajectory" };
  }

  // Must cross each gate through the opening (closest sample to gate x)
  for (const gate of c.gates) {
    const band = samples.filter(
      (s) => Math.abs(s.x - gate.x) <= gate.gateThickness + c.ball.size + 8,
    );
    if (band.length === 0) {
      return { correct: false, reason: "incomplete_path" };
    }
    const crossing = band.reduce((best, s) =>
      Math.abs(s.x - gate.x) < Math.abs(best.x - gate.x) ? s : best,
    );
    const cycleT =
      c.durationMs > 0
        ? ((crossing.t % c.durationMs) + c.durationMs) % c.durationMs
        : crossing.t;
    const center = gateOpeningCenter(challenge, gate.id, cycleT);
    const half = gate.openingHeight / 2 - c.ball.size * 0.35;
    if (Math.abs(crossing.y - center) > half) {
      return { correct: false, reason: "gate_collision" };
    }
  }

  const last = samples[samples.length - 1]!;
  if (last.x < truth.goalX - 40) {
    return { correct: false, reason: "incomplete_path" };
  }

  return { correct: true };
}

export function dynamicPathLeaksHiddenState(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  if (text.includes('"segments"')) return true;
  if (text.includes("openingCenterStart")) return true;
  if (text.includes("accessibleGateSlots")) return true;
  if (text.includes("groundTruth")) return true;
  if (text.includes('"velocity"')) return true;
  return false;
}
