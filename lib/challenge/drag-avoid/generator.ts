import { randomInt, randomUUID } from "crypto";
import { getChallengeTtlMs } from "@/lib/config/env";
import { getDragAvoidDifficulty } from "@/lib/challenge/core/difficulty";
import type {
  DragAvoidGroundTruth,
  DragAvoidObstaclePlan,
  DragAvoidRenderConfiguration,
  MotionSegment,
  StoredChallenge,
  Vec2,
} from "@/lib/challenge/types";
import { computeExpiresAt } from "@/lib/security/expiry";
import { generateNonce } from "@/lib/security/nonce";

const CANVAS = { width: 640, height: 360 };

function randomSpeed(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function buildSegments(
  durationMs: number,
  speedMin: number,
  speedMax: number,
  complexity: number,
): MotionSegment[] {
  const parts = Math.max(2, complexity + 1);
  const base = Math.floor(durationMs / parts);
  const remainder = durationMs - base * parts;
  const segments: MotionSegment[] = [];
  let angle = Math.random() * Math.PI * 2;
  let elapsed = 0;
  for (let i = 0; i < parts; i += 1) {
    if (i > 0) {
      angle += (Math.PI / 2) * (0.6 + Math.random() * 0.8) * (Math.random() < 0.5 ? 1 : -1);
    }
    const speed = randomSpeed(speedMin, speedMax);
    elapsed += base + (i === parts - 1 ? remainder : 0);
    segments.push({
      endMs: elapsed,
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    });
  }
  return segments;
}

function startAwayFrom(avoid: Vec2, size: number): Vec2 {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const p = {
      x: size + 20 + Math.random() * (CANVAS.width - size * 2 - 40),
      y: size + 20 + Math.random() * (CANVAS.height - size * 2 - 40),
    };
    const dx = p.x - avoid.x;
    const dy = p.y - avoid.y;
    if (dx * dx + dy * dy > 120 * 120) return p;
  }
  return { x: CANVAS.width - 80, y: 80 };
}

export type GenerateDragAvoidOptions = {
  difficulty?: number;
  sessionId?: string;
  now?: Date;
  ttlMs?: number;
};

export function generateDragAvoidChallenge(
  options: GenerateDragAvoidOptions = {},
): StoredChallenge {
  const profile = getDragAvoidDifficulty(options.difficulty ?? 1);
  const now = options.now ?? new Date();
  const ttlMs = options.ttlMs ?? getChallengeTtlMs();

  const obstacleCount = randomInt(
    profile.obstacleCount.min,
    profile.obstacleCount.max + 1,
  );

  const agentStart: Vec2 = { x: 70, y: CANVAS.height / 2 };
  const targetPos: Vec2 = { x: CANVAS.width - 80, y: CANVAS.height / 2 };
  const agentSize = 18;
  const targetSize = 28;

  const obstacles: DragAvoidObstaclePlan[] = [];
  for (let i = 0; i < obstacleCount; i += 1) {
    const size = 16 + randomInt(0, 8);
    obstacles.push({
      id: `obstacle_${i + 1}`,
      size,
      start: startAwayFrom(agentStart, size),
      segments: buildSegments(
        profile.durationMs,
        profile.speedRange.min,
        profile.speedRange.max,
        profile.complexity,
      ),
    });
  }

  const instruction =
    "Drag the blue object to the green target without hitting the moving obstacles.";

  const renderConfiguration: DragAvoidRenderConfiguration = {
    width: CANVAS.width,
    height: CANVAS.height,
    durationMs: profile.durationMs,
    instruction,
    agent: {
      id: "agent",
      size: agentSize,
      color: "#3d8bfd",
      start: agentStart,
    },
    target: {
      id: "target",
      size: targetSize,
      color: "#20c997",
      position: targetPos,
    },
    obstacles,
  };

  // Accessible corridor labels - server-only correct sequence
  const labels = ["north", "center", "south"] as const;
  const accessibleSafePath = Array.from({ length: obstacleCount }, () =>
    labels[randomInt(labels.length)]!,
  );

  const groundTruth: DragAvoidGroundTruth = {
    agentId: "agent",
    targetId: "target",
    targetRadius: targetSize,
    maxSpeedPxPerSec: 420,
    collisionPadding: 2,
    accessibleSafePath: [...accessibleSafePath],
  };

  return {
    challengeId: randomUUID(),
    sessionId: options.sessionId ?? randomUUID(),
    nonce: generateNonce(),
    issuedAt: now.toISOString(),
    expiresAt: computeExpiresAt(ttlMs, now).toISOString(),
    difficulty: profile.level,
    challengeType: "drag_avoid",
    renderConfiguration,
    groundTruth,
    lifecycle: "issued",
    framePollCount: 0,
    consumed: false,
    failedAttempts: 0,
  };
}
