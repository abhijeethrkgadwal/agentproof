import type { InteractionPayload, AnswerValidation } from "@/lib/challenge/core/types";
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
      "Accessible mode: pick the safe opening slot for each gate (0–2). Pilot only — not WCAG-certified.",
  };
}

export function toDynamicPathFrame(
  challenge: StoredChallenge,
  elapsedMs: number,
): FrameResponse {
  const c = cfg(challenge);
  const t = Math.max(0, Math.min(elapsedMs, c.durationMs));
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
    elapsedMs: t,
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

  if (input.interaction?.accessibleAnswers) {
    const raw = String(input.interaction.accessibleAnswers.slots ?? "");
    const slots = raw.split(",").map((s) => Number(s.trim()));
    if (
      slots.length === truth.accessibleGateSlots.length &&
      slots.every((v, i) => v === truth.accessibleGateSlots[i])
    ) {
      return { correct: true };
    }
    return { correct: false, reason: "invalid_accessible_answer" };
  }

  const samples = (input.interaction?.samples ?? []).filter(
    (s) => !s.objectId || s.objectId === truth.ballId,
  );
  if (samples.length < 3) {
    return { correct: false, reason: "invalid_trajectory" };
  }

  const first = samples[0]!;
  if (Math.hypot(first.x - c.ball.start.x, first.y - c.ball.start.y) > 50) {
    return { correct: false, reason: "invalid_start" };
  }

  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    const dt = Math.max(1, b.t - a.t) / 1000;
    if (Math.hypot(b.x - a.x, b.y - a.y) / dt > truth.maxSpeedPxPerSec * 1.35) {
      return { correct: false, reason: "invalid_trajectory" };
    }
  }

  // Must cross each gate through the opening (not the wall)
  for (const gate of c.gates) {
    const crossing = samples.find(
      (s) => Math.abs(s.x - gate.x) <= gate.gateThickness + c.ball.size,
    );
    if (!crossing) {
      return { correct: false, reason: "incomplete_path" };
    }
    const center = gateOpeningCenter(challenge, gate.id, crossing.t);
    const half = gate.openingHeight / 2 - c.ball.size * 0.6;
    if (Math.abs(crossing.y - center) > half) {
      return { correct: false, reason: "gate_collision" };
    }
  }

  const last = samples[samples.length - 1]!;
  if (last.x < truth.goalX - 30) {
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
