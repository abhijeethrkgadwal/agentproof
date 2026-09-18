import { randomBytes, randomInt, randomUUID } from "crypto";
import { getChallengeTtlMs } from "@/lib/config/env";
import { getDifficultyProfile } from "@/lib/challenge/difficulty";
import type {
  MotionSegment,
  RenderObject,
  ShapeKind,
  StoredChallenge,
  TemporalGroundTruth,
  TemporalRenderConfiguration,
  Vec2,
} from "@/lib/challenge/types";
import { computeExpiresAt } from "@/lib/security/expiry";
import { generateNonce } from "@/lib/security/nonce";

const SHAPES: ShapeKind[] = ["circle", "square", "triangle", "diamond", "hexagon"];
const COLORS = [
  "#3d8bfd",
  "#20c997",
  "#ffc107",
  "#fd7e14",
  "#e35d6a",
  "#6f42c1",
  "#0dcaf0",
  "#adb5bd",
];

const CANVAS = { width: 640, height: 360 };

function pickUniqueColors(count: number): string[] {
  const pool = [...COLORS];
  const result: string[] = [];
  for (let i = 0; i < count; i += 1) {
    if (pool.length === 0) {
      result.push(COLORS[i % COLORS.length]!);
      continue;
    }
    const idx = randomInt(pool.length);
    result.push(pool.splice(idx, 1)[0]!);
  }
  return result;
}

function randomSpeed(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomAngle(): number {
  return Math.random() * Math.PI * 2;
}

function velocityFromAngle(speed: number, angle: number): Vec2 {
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomStart(size: number): Vec2 {
  const margin = size + 8;
  return {
    x: margin + Math.random() * (CANVAS.width - margin * 2),
    y: margin + Math.random() * (CANVAS.height - margin * 2),
  };
}

/**
 * Build motion segments with an exact number of direction changes.
 * A direction change is a velocity angle delta > ~30 degrees.
 */
function buildSegments(
  durationMs: number,
  directionChanges: number,
  speedMin: number,
  speedMax: number,
): MotionSegment[] {
  const parts = directionChanges + 1;
  const base = Math.floor(durationMs / parts);
  const remainder = durationMs - base * parts;
  const lengths: number[] = [];
  for (let i = 0; i < parts; i += 1) {
    lengths.push(base + (i === parts - 1 ? remainder : 0));
  }

  const segments: MotionSegment[] = [];
  let angle = randomAngle();
  let elapsed = 0;

  for (let i = 0; i < parts; i += 1) {
    if (i > 0) {
      // Force a meaningful direction change
      const delta = (Math.PI / 2) * (0.7 + Math.random() * 0.6);
      angle += Math.random() < 0.5 ? delta : -delta;
    }
    const speed = randomSpeed(speedMin, speedMax);
    elapsed += lengths[i]!;
    segments.push({
      endMs: elapsed,
      velocity: velocityFromAngle(speed, angle),
    });
  }

  return segments;
}

function countDirectionChanges(segments: MotionSegment[]): number {
  if (segments.length <= 1) return 0;
  let changes = 0;
  for (let i = 1; i < segments.length; i += 1) {
    const prev = segments[i - 1]!.velocity;
    const curr = segments[i]!.velocity;
    const a1 = Math.atan2(prev.y, prev.x);
    const a2 = Math.atan2(curr.y, curr.x);
    let delta = Math.abs(a2 - a1);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    if (delta > Math.PI / 6) {
      changes += 1;
    }
  }
  return changes;
}

export type GenerateChallengeOptions = {
  difficulty?: number;
  sessionId?: string;
  now?: Date;
  ttlMs?: number;
  /** Deterministic seed helper for tests — when set, uses fixed required changes. */
  requiredDirectionChanges?: number;
};

/**
 * Deterministic-structure temporal challenge generator.
 * Ground truth stays server-side; only renderConfiguration is client-safe.
 */
export function generateTemporalChallenge(
  options: GenerateChallengeOptions = {},
): StoredChallenge {
  const difficulty = options.difficulty ?? 1;
  const profile = getDifficultyProfile(difficulty);
  const now = options.now ?? new Date();
  const ttlMs = options.ttlMs ?? getChallengeTtlMs();

  const objectCount = randomInt(
    profile.objectCount.min,
    profile.objectCount.max + 1,
  );
  const requiredDirectionChanges =
    options.requiredDirectionChanges ??
    clamp(profile.maxDirectionChanges, 1, profile.maxDirectionChanges);

  const colors = pickUniqueColors(objectCount);
  const objects: RenderObject[] = [];
  const directionChangeCounts: Record<string, number> = {};

  // Choose exactly one target index that will have the required change count
  const targetIndex = randomInt(objectCount);

  for (let i = 0; i < objectCount; i += 1) {
    const id = `object_${i + 1}`;
    const size = 18 + randomInt(0, 8);
    const isTarget = i === targetIndex;

    let changes: number;
    if (isTarget) {
      changes = requiredDirectionChanges;
    } else {
      // Distractors: any count except the required one
      const candidates = [];
      for (let c = 0; c <= profile.maxDirectionChanges + 1; c += 1) {
        if (c !== requiredDirectionChanges) candidates.push(c);
      }
      changes = candidates[randomInt(candidates.length)]!;
    }

    const segments = buildSegments(
      profile.durationMs,
      changes,
      profile.speedRange.min,
      profile.speedRange.max,
    );

    // Soft wrap hint: keep start away from edges handled in renderer
    objects.push({
      id,
      shape: SHAPES[randomInt(SHAPES.length)]!,
      color: colors[i]!,
      size,
      start: randomStart(size),
      segments,
    });
    directionChangeCounts[id] = countDirectionChanges(segments);
  }

  // Ensure uniqueness: if somehow another object matches, adjust distractors
  const correctObjectId = objects[targetIndex]!.id;
  for (const obj of objects) {
    if (obj.id === correctObjectId) continue;
    if (directionChangeCounts[obj.id] === requiredDirectionChanges) {
      // Rebuild with zero changes
      obj.segments = buildSegments(
        profile.durationMs,
        0,
        profile.speedRange.min,
        profile.speedRange.max,
      );
      directionChangeCounts[obj.id] = countDirectionChanges(obj.segments);
    }
  }

  const instruction = `Select the object that changed direction exactly ${requiredDirectionChanges} time${requiredDirectionChanges === 1 ? "" : "s"}.`;

  const renderConfiguration: TemporalRenderConfiguration = {
    width: CANVAS.width,
    height: CANVAS.height,
    durationMs: profile.durationMs,
    instruction,
    requiredDirectionChanges,
    objects,
  };

  const groundTruth: TemporalGroundTruth = {
    correctObjectId,
    requiredDirectionChanges,
    directionChangeCounts,
  };

  const challengeId = randomUUID();
  const sessionId = options.sessionId ?? randomUUID();
  const nonce = generateNonce();
  // Touch randomBytes so crypto import is exercised in generators
  void randomBytes(4);

  return {
    challengeId,
    sessionId,
    nonce,
    issuedAt: now.toISOString(),
    expiresAt: computeExpiresAt(ttlMs, now).toISOString(),
    difficulty: profile.level,
    challengeType: "temporal",
    renderConfiguration,
    groundTruth,
    consumed: false,
    failedAttempts: 0,
  };
}
