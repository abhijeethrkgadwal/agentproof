import type { InteractionPayload, AnswerValidation } from "@/lib/challenge/core/types";
import {
  normalizeTrajectorySamples,
  trajectoryWithinSpeed,
} from "@/lib/challenge/core/trajectory";
import {
  circlesOverlap,
  pointInCircle,
  segmentPositionAt,
} from "@/lib/challenge/motion";
import type {
  DragAvoidGroundTruth,
  DragAvoidRenderConfiguration,
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
      },
    },
    accessibilityHint:
      "Accessible mode: discrete arrow nudges with live position announcements. Pilot only — not WCAG-certified.",
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
  // Loop motion after the window so obstacles never appear "frozen" while the
  // player is still interacting / verifying.
  const cycle = c.durationMs > 0 ? elapsedMs % c.durationMs : 0;
  const t = Math.max(0, Math.min(cycle, c.durationMs));
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
    elapsedMs: Math.min(elapsedMs, c.durationMs),
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

  if (
    input.interaction?.accessibleAnswers &&
    (!input.interaction.samples || input.interaction.samples.length < 3)
  ) {
    return { correct: false, reason: "invalid_accessible_answer" };
  }

  const rawSamples = input.interaction?.samples ?? [];
  const filtered = rawSamples.filter(
    (s) => !s.objectId || s.objectId === truth.agentId,
  );
  const agentSamples = normalizeTrajectorySamples(filtered);
  if (agentSamples.length < 3) {
    return { correct: false, reason: "invalid_trajectory" };
  }

  const first = agentSamples[0]!;
  const dx0 = first.x - c.agent.start.x;
  const dy0 = first.y - c.agent.start.y;
  if (dx0 * dx0 + dy0 * dy0 > (c.agent.size * 3.5) ** 2) {
    return { correct: false, reason: "invalid_start" };
  }

  // Human-tolerant speed (asymmetric paths + pointer jitter / flicks)
  if (!trajectoryWithinSpeed(agentSamples, Math.max(1600, truth.maxSpeedPxPerSec * 4))) {
    return { correct: false, reason: "invalid_trajectory" };
  }

  const obstacleAt = (o: (typeof c.obstacles)[number], t: number) => {
    const pos = segmentPositionAt(o.start, o.segments, t);
    return {
      x: Math.min(c.width - o.size, Math.max(o.size, pos.x)),
      y: Math.min(c.height - o.size, Math.max(o.size, pos.y)),
    };
  };

  const collides = (x: number, y: number, t: number) => {
    // Match display loop: obstacles cycle after durationMs.
    const cycleT =
      c.durationMs > 0
        ? ((t % c.durationMs) + c.durationMs) % c.durationMs
        : t;
    for (const o of c.obstacles) {
      const pos = obstacleAt(o, cycleT);
      if (
        circlesOverlap(
          { x, y },
          c.agent.size,
          pos,
          o.size,
          truth.collisionPadding,
        )
      ) {
        return true;
      }
    }
    return false;
  };

  for (const sample of agentSamples) {
    const t = Math.max(0, Math.min(sample.t, c.durationMs));
    if (collides(sample.x, sample.y, t)) {
      return { correct: false, reason: "collision" };
    }
  }

  const last = agentSamples[agentSamples.length - 1]!;
  const onTarget = pointInCircle(
    { x: last.x, y: last.y },
    c.target.position,
    truth.targetRadius + c.agent.size * 0.5,
  );
  if (!onTarget) {
    return { correct: false, reason: "missed_target" };
  }

  // Only hold-check a short grace window — early finish should not fail
  // because an obstacle later sweeps the parked agent.
  const holdEnd = Math.min(c.durationMs, last.t + 400);
  for (let t = last.t; t <= holdEnd; t += 100) {
    if (collides(last.x, last.y, t)) {
      return { correct: false, reason: "collision" };
    }
  }

  return { correct: true };
}

export function dragAvoidLeaksHiddenState(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  if (text.includes('"segments"')) return true;
  if (text.includes("accessibleSafePath")) return true;
  if (text.includes("groundTruth")) return true;
  if (text.includes('"velocity"')) return true;
  if (text.includes('"obstacles"') && text.includes('"start"')) return true;
  return false;
}
