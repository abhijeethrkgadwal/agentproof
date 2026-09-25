import type { InteractionPayload, AnswerValidation } from "@/lib/challenge/core/types";
import {
  normalizeTrajectorySamples,
  trajectoryWithinSpeed,
} from "@/lib/challenge/core/trajectory";
import { pointInRect, rectsOverlap } from "@/lib/challenge/motion";
import type {
  FrameResponse,
  ObjectPose,
  PhysicalGroundTruth,
  PhysicalRenderConfiguration,
  PublicChallengeResponse,
  StoredChallenge,
  Vec2,
} from "@/lib/challenge/types";
import { isPhysicalChallenge } from "@/lib/challenge/types";

function cfg(challenge: StoredChallenge): PhysicalRenderConfiguration {
  if (!isPhysicalChallenge(challenge)) throw new Error("not_physical");
  return challenge.renderConfiguration;
}

function gt(challenge: StoredChallenge): PhysicalGroundTruth {
  if (!isPhysicalChallenge(challenge)) throw new Error("not_physical");
  return challenge.groundTruth;
}

type BodyState = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role: string;
  color: string;
  rotation: number;
};

function bodyRect(b: BodyState) {
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

/**
 * Lightweight deterministic physics: moving the agent into the protected
 * block pushes it by the overlap amount (axis-separated).
 */
export function simulatePhysical(
  challenge: StoredChallenge,
  agentPath: Vec2[],
): BodyState[] {
  const c = cfg(challenge);
  const states: BodyState[] = c.bodies.map((b) => ({
    id: b.id,
    x: b.start.x,
    y: b.start.y,
    width: b.width,
    height: b.height,
    role: b.role,
    color: b.color,
    rotation: b.rotation,
  }));

  const agent = states.find((s) => s.id === "agent")!;
  const protectedBody = states.find((s) => s.id === "protected")!;

  for (const pos of agentPath) {
    agent.x = pos.x - agent.width / 2;
    agent.y = pos.y - agent.height / 2;

    if (rectsOverlap(bodyRect(agent), bodyRect(protectedBody))) {
      const a = bodyRect(agent);
      const p = bodyRect(protectedBody);
      const overlapX =
        Math.min(a.x + a.width, p.x + p.width) - Math.max(a.x, p.x);
      const overlapY =
        Math.min(a.y + a.height, p.y + p.height) - Math.max(a.y, p.y);
      if (overlapX < overlapY) {
        const push = agent.x + agent.width / 2 < protectedBody.x + protectedBody.width / 2
          ? overlapX
          : -overlapX;
        protectedBody.x += push;
      } else {
        const push = agent.y + agent.height / 2 < protectedBody.y + protectedBody.height / 2
          ? overlapY
          : -overlapY;
        protectedBody.y += push;
      }
    }
  }

  return states;
}

export function toPhysicalPublic(
  challenge: StoredChallenge,
  token: string,
): PublicChallengeResponse {
  const c = cfg(challenge);
  return {
    challengeId: challenge.challengeId,
    token,
    challengeType: "physical",
    sessionId: challenge.sessionId,
    expiresAt: challenge.expiresAt,
    difficulty: challenge.difficulty,
    instruction: c.instruction,
    lifecycle: challenge.lifecycle,
    scene: {
      width: c.width,
      height: c.height,
      durationMs: c.durationMs,
      objects: c.bodies.map((b) => ({
        id: b.id,
        shape: "square" as const,
        color: b.color,
        size: Math.max(b.width, b.height) / 2,
      })),
      layout: {
        platform: c.platform,
        bodies: c.bodies.map((b) => ({
          id: b.id,
          role: b.role,
          color: b.color,
          width: b.width,
          height: b.height,
          start: b.start,
          rotation: b.rotation,
          draggable: b.draggable,
        })),
        // protectedBounds / accessible key stay server-only
      },
    },
    accessibilityHint:
      "Accessible mode: discrete nudges with live position announcements. Pilot only - not WCAG-certified.",
  };
}

export function toPhysicalFrame(
  challenge: StoredChallenge,
  elapsedMs: number,
): FrameResponse {
  const c = cfg(challenge);
  const t = Math.max(0, Math.min(elapsedMs, c.durationMs));
  const poses: ObjectPose[] = c.bodies.map((b) => ({
    id: b.id,
    shape: "square",
    color: b.color,
    size: Math.max(b.width, b.height) / 2,
    x: b.start.x + b.width / 2,
    y: b.start.y + b.height / 2,
    rotation: b.rotation,
    role: b.role,
  }));
  // Platform as a pose for rendering
  poses.push({
    id: c.platform.id,
    shape: "square",
    color: "#475569",
    size: c.platform.width / 2,
    x: c.platform.x + c.platform.width / 2,
    y: c.platform.y + c.platform.height / 2,
    role: "platform",
  });
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

export function validatePhysical(
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
    (!input.interaction.samples || input.interaction.samples.length < 2)
  ) {
    return { correct: false, reason: "invalid_accessible_answer" };
  }

  const samples = normalizeTrajectorySamples(
    (input.interaction?.samples ?? []).filter(
      (s) => !s.objectId || s.objectId === truth.agentId,
    ),
  );
  if (samples.length < 2) {
    return { correct: false, reason: "invalid_trajectory" };
  }

  const first = samples[0]!;
  const agentBody = c.bodies.find((b) => b.id === truth.agentId)!;
  const startCenter = {
    x: agentBody.start.x + agentBody.width / 2,
    y: agentBody.start.y + agentBody.height / 2,
  };
  if (Math.hypot(first.x - startCenter.x, first.y - startCenter.y) > 90) {
    return { correct: false, reason: "invalid_start" };
  }

  if (!trajectoryWithinSpeed(samples, Math.max(1600, truth.maxAgentSpeed * 4))) {
    return { correct: false, reason: "invalid_trajectory" };
  }

  const path = samples.map((s) => ({ x: s.x, y: s.y }));
  const finalStates = simulatePhysical(challenge, path);
  const agent = finalStates.find((s) => s.id === truth.agentId)!;
  const protectedBody = finalStates.find((s) => s.id === truth.protectedId)!;

  const agentCenter = {
    x: agent.x + agent.width / 2,
    y: agent.y + agent.height / 2,
  };
  // Allow landing anywhere on the platform (including edges)
  const platformExpanded = {
    x: c.platform.x - 8,
    y: c.platform.y - 8,
    width: c.platform.width + 16,
    height: c.platform.height + 16,
  };
  if (!pointInRect(agentCenter, platformExpanded)) {
    return { correct: false, reason: "missed_target" };
  }

  const protectedCenter = {
    x: protectedBody.x + protectedBody.width / 2,
    y: protectedBody.y + protectedBody.height / 2,
  };
  if (!pointInRect(protectedCenter, c.protectedBounds)) {
    return { correct: false, reason: "protected_displaced" };
  }

  return { correct: true };
}

export function physicalLeaksHiddenState(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  if (text.includes("accessiblePlacementKey")) return true;
  if (text.includes("protectedBounds")) return true;
  if (text.includes("groundTruth")) return true;
  return false;
}
