import type { InteractionPayload, AnswerValidation } from "@/lib/challenge/core/types";
import {
  circlesOverlap,
  pointInCircle,
  segmentPositionAt,
} from "@/lib/challenge/motion";
import type {
  DragAvoidRenderConfiguration,
  DragAvoidGroundTruth,
  FrameResponse,
  ObjectPose,
  PublicChallengeResponse,
  StoredChallenge,
} from "@/lib/challenge/types";
import { isDragAvoidChallenge } from "@/lib/challenge/types";

function cfg(challenge: StoredChallenge): DragAvoidRenderConfiguration {
  if (!isDragAvoidChallenge(challenge)) {
    throw new Error("not_drag_avoid");
  }
  return challenge.renderConfiguration;
}

function gt(challenge: StoredChallenge): DragAvoidGroundTruth {
  if (!isDragAvoidChallenge(challenge)) {
    throw new Error("not_drag_avoid");
  }
  return challenge.groundTruth;
}

export function toDragAvoidPublic(
  challenge: StoredChallenge,
  token: string,
): PublicChallengeResponse {
  const c = cfg(challenge);
  return {
    challengeId: challenge.challengeId,
    token,
    challengeType: "drag_avoid",
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
          id: c.agent.id,
          shape: "circle",
          color: c.agent.color,
          size: c.agent.size,
        },
        {
          id: c.target.id,
          shape: "circle",
          color: c.target.color,
          size: c.target.size,
        },
        ...c.obstacles.map((o) => ({
          id: o.id,
          shape: "circle" as const,
          color: "#e35d6a",
          size: o.size,
        })),
      ],
      layout: {
        agentStart: c.agent.start,
        target: c.target.position,
        obstacleCount: c.obstacles.length,
        // No obstacle starts / segments
      },
    },
    accessibilityHint:
      "Accessible mode: choose a safe corridor sequence with the keyboard. Pilot only — not WCAG-certified.",
  };
}

export function obstaclePosesAt(
  challenge: StoredChallenge,
  elapsedMs: number,
): ObjectPose[] {
  const c = cfg(challenge);
  const t = Math.max(0, Math.min(elapsedMs, c.durationMs));
  return c.obstacles.map((o) => {
    const pos = segmentPositionAt(o.start, o.segments, t);
    return {
      id: o.id,
      shape: "circle" as const,
      color: "#e35d6a",
      size: o.size,
      x: Math.min(c.width - o.size, Math.max(o.size, pos.x)),
      y: Math.min(c.height - o.size, Math.max(o.size, pos.y)),
      role: "obstacle",
    };
  });
}

export function toDragAvoidFrame(
  challenge: StoredChallenge,
  elapsedMs: number,
): FrameResponse {
  const c = cfg(challenge);
  const t = Math.max(0, Math.min(elapsedMs, c.durationMs));
  const obstacles = obstaclePosesAt(challenge, t);
  const poses: ObjectPose[] = [
    {
      id: c.agent.id,
      shape: "circle",
      color: c.agent.color,
      size: c.agent.size,
      x: c.agent.start.x,
      y: c.agent.start.y,
      role: "agent",
    },
    {
      id: c.target.id,
      shape: "circle",
      color: c.target.color,
      size: c.target.size,
      x: c.target.position.x,
      y: c.target.position.y,
      role: "target",
    },
    ...obstacles,
  ];
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

export function validateDragAvoid(
  challenge: StoredChallenge,
  input: {
    selectedObjectId?: string;
    interaction?: InteractionPayload;
  },
): AnswerValidation {
  const c = cfg(challenge);
  const truth = gt(challenge);

  // Accessible fallback path
  if (input.interaction?.accessibleAnswers) {
    const path = String(input.interaction.accessibleAnswers.path ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      path.length === truth.accessibleSafePath.length &&
      path.every((v, i) => v === truth.accessibleSafePath[i])
    ) {
      return { correct: true };
    }
    return { correct: false, reason: "invalid_accessible_answer" };
  }

  const samples = input.interaction?.samples ?? [];
  if (samples.length < 3) {
    return { correct: false, reason: "invalid_trajectory" };
  }

  const agentSamples = samples.filter(
    (s) => !s.objectId || s.objectId === truth.agentId,
  );
  if (agentSamples.length < 3) {
    return { correct: false, reason: "incorrect_object" };
  }

  const first = agentSamples[0]!;
  const dx0 = first.x - c.agent.start.x;
  const dy0 = first.y - c.agent.start.y;
  if (dx0 * dx0 + dy0 * dy0 > (c.agent.size * 2.5) ** 2) {
    return { correct: false, reason: "invalid_start" };
  }

  // Continuity / speed
  for (let i = 1; i < agentSamples.length; i += 1) {
    const a = agentSamples[i - 1]!;
    const b = agentSamples[i]!;
    const dt = Math.max(1, b.t - a.t) / 1000;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    if (dist / dt > truth.maxSpeedPxPerSec * 1.35) {
      return { correct: false, reason: "invalid_trajectory" };
    }
  }

  // Collisions with obstacles at sample times
  for (const sample of agentSamples) {
    const t = Math.max(0, Math.min(sample.t, c.durationMs));
    for (const o of c.obstacles) {
      const pos = segmentPositionAt(o.start, o.segments, t);
      if (
        circlesOverlap(
          { x: sample.x, y: sample.y },
          c.agent.size,
          pos,
          o.size,
          truth.collisionPadding,
        )
      ) {
        return { correct: false, reason: "collision" };
      }
    }
  }

  const last = agentSamples[agentSamples.length - 1]!;
  if (
    !pointInCircle(
      { x: last.x, y: last.y },
      c.target.position,
      truth.targetRadius + c.agent.size * 0.35,
    )
  ) {
    return { correct: false, reason: "missed_target" };
  }

  return { correct: true };
}

export function dragAvoidLeaksHiddenState(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  if (text.includes('"segments"')) return true;
  if (text.includes("accessibleSafePath")) return true;
  if (text.includes("groundTruth")) return true;
  if (text.includes('"velocity"')) return true;
  // Obstacle starts must not appear in public issue payload
  if (text.includes('"obstacles"') && text.includes('"start"')) return true;
  return false;
}
