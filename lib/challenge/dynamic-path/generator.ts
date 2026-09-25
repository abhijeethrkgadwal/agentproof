import { randomInt, randomUUID } from "crypto";
import { getChallengeTtlMs } from "@/lib/config/env";
import { getDynamicPathDifficulty } from "@/lib/challenge/core/difficulty";
import type {
  DynamicGatePlan,
  DynamicPathGroundTruth,
  DynamicPathRenderConfiguration,
  MotionSegment,
  StoredChallenge,
} from "@/lib/challenge/types";
import { computeExpiresAt } from "@/lib/security/expiry";
import { generateNonce } from "@/lib/security/nonce";

const CANVAS = { width: 640, height: 360 };

function buildVerticalSegments(
  durationMs: number,
  speedMin: number,
  speedMax: number,
  complexity: number,
): MotionSegment[] {
  const parts = Math.max(2, complexity + 1);
  const base = Math.floor(durationMs / parts);
  const remainder = durationMs - base * parts;
  const segments: MotionSegment[] = [];
  let dir = Math.random() < 0.5 ? 1 : -1;
  let elapsed = 0;
  for (let i = 0; i < parts; i += 1) {
    if (i > 0) dir *= -1;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    elapsed += base + (i === parts - 1 ? remainder : 0);
    segments.push({
      endMs: elapsed,
      velocity: { x: 0, y: dir * speed },
    });
  }
  return segments;
}

export type GenerateDynamicPathOptions = {
  difficulty?: number;
  sessionId?: string;
  now?: Date;
  ttlMs?: number;
};

export function generateDynamicPathChallenge(
  options: GenerateDynamicPathOptions = {},
): StoredChallenge {
  const profile = getDynamicPathDifficulty(options.difficulty ?? 1);
  const now = options.now ?? new Date();
  const ttlMs = options.ttlMs ?? getChallengeTtlMs();

  const gateCount = randomInt(
    profile.obstacleCount.min,
    profile.obstacleCount.max + 1,
  );

  const openingHeight = Math.max(70, 110 - profile.complexity * 8);
  const gates: DynamicGatePlan[] = [];
  for (let i = 0; i < gateCount; i += 1) {
    const x = 180 + i * Math.floor((CANVAS.width - 260) / Math.max(1, gateCount));
    gates.push({
      id: `gate_${i + 1}`,
      openingCenterStart: CANVAS.height * (0.3 + Math.random() * 0.4),
      openingHeight,
      gateThickness: 18,
      x,
      segments: buildVerticalSegments(
        profile.durationMs,
        profile.speedRange.min,
        profile.speedRange.max,
        profile.complexity,
      ),
    });
  }

  const instruction = "Guide the ball through the opening.";

  const renderConfiguration: DynamicPathRenderConfiguration = {
    width: CANVAS.width,
    height: CANVAS.height,
    durationMs: profile.durationMs,
    instruction,
    ball: {
      id: "ball",
      size: 16,
      color: "#ffc107",
      start: { x: 50, y: CANVAS.height / 2 },
    },
    gates,
    goalX: CANVAS.width - 40,
  };

  // Accessible: discrete slot index per gate (0=top,1=mid,2=bottom) that is safe
  // at a reference mid-time - stored server-side only.
  const accessibleGateSlots = gates.map(() => randomInt(0, 3));

  const groundTruth: DynamicPathGroundTruth = {
    ballId: "ball",
    goalX: CANVAS.width - 40,
    maxSpeedPxPerSec: 400,
    accessibleGateSlots,
  };

  return {
    challengeId: randomUUID(),
    sessionId: options.sessionId ?? randomUUID(),
    nonce: generateNonce(),
    issuedAt: now.toISOString(),
    expiresAt: computeExpiresAt(ttlMs, now).toISOString(),
    difficulty: profile.level,
    challengeType: "dynamic_path",
    renderConfiguration,
    groundTruth,
    lifecycle: "issued",
    framePollCount: 0,
    consumed: false,
    failedAttempts: 0,
  };
}
