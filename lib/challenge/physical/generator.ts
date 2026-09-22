import { randomInt, randomUUID } from "crypto";
import { getChallengeTtlMs } from "@/lib/config/env";
import { getPhysicalDifficulty } from "@/lib/challenge/core/difficulty";
import type {
  PhysicalBody,
  PhysicalGroundTruth,
  PhysicalRenderConfiguration,
  StoredChallenge,
} from "@/lib/challenge/types";
import { computeExpiresAt } from "@/lib/security/expiry";
import { generateNonce } from "@/lib/security/nonce";

const CANVAS = { width: 640, height: 360 };

export type GeneratePhysicalOptions = {
  difficulty?: number;
  sessionId?: string;
  now?: Date;
  ttlMs?: number;
};

export function generatePhysicalChallenge(
  options: GeneratePhysicalOptions = {},
): StoredChallenge {
  const profile = getPhysicalDifficulty(options.difficulty ?? 1);
  const now = options.now ?? new Date();
  const ttlMs = options.ttlMs ?? getChallengeTtlMs();

  const platform = {
    id: "platform",
    x: CANVAS.width / 2 - 110,
    y: CANVAS.height - 90,
    width: 220,
    height: 28,
  };

  const protectedBody: PhysicalBody = {
    id: "protected",
    role: "protected",
    color: "#3d8bfd",
    width: 36,
    height: 36,
    start: {
      x: platform.x + platform.width / 2 - 18,
      y: platform.y - 40,
    },
    rotation: 0,
    draggable: false,
  };

  const agent: PhysicalBody = {
    id: "agent",
    role: "agent",
    color: "#e35d6a",
    width: 40,
    height: 40,
    start: { x: 60, y: CANVAS.height - 120 },
    rotation: 0,
    draggable: true,
  };

  const bodies: PhysicalBody[] = [agent, protectedBody];

  // Extra static props at higher difficulty (visual complexity only)
  const extras = Math.min(2, Math.max(0, profile.complexity - 1));
  for (let i = 0; i < extras; i += 1) {
    bodies.push({
      id: `static_${i + 1}`,
      role: "static",
      color: "#64748b",
      width: 28,
      height: 28,
      start: {
        x: 40 + i * 50,
        y: 40 + randomInt(0, 40),
      },
      rotation: 0,
      draggable: false,
    });
  }

  const instruction =
    "Place the red block on the platform without knocking the blue block off.";

  const renderConfiguration: PhysicalRenderConfiguration = {
    width: CANVAS.width,
    height: CANVAS.height,
    durationMs: profile.durationMs,
    instruction,
    bodies,
    platform,
    protectedBounds: {
      x: platform.x - 8,
      y: platform.y - 80,
      width: platform.width + 16,
      height: 100,
    },
  };

  const placementKeys = ["left", "center", "right"] as const;
  const accessiblePlacementKey = placementKeys[randomInt(placementKeys.length)]!;

  const groundTruth: PhysicalGroundTruth = {
    agentId: "agent",
    protectedId: "protected",
    platformId: "platform",
    accessiblePlacementKey,
    maxAgentSpeed: 380,
  };

  return {
    challengeId: randomUUID(),
    sessionId: options.sessionId ?? randomUUID(),
    nonce: generateNonce(),
    issuedAt: now.toISOString(),
    expiresAt: computeExpiresAt(ttlMs, now).toISOString(),
    difficulty: profile.level,
    challengeType: "physical",
    renderConfiguration,
    groundTruth,
    lifecycle: "issued",
    framePollCount: 0,
    consumed: false,
    failedAttempts: 0,
  };
}
