/**
 * Difficulty profiles for natural-interaction challenges (v0.2).
 * Temporal difficulty remains in lib/challenge/difficulty.ts.
 */

export type NaturalDifficultyProfile = {
  level: number;
  durationMs: number;
  obstacleCount: { min: number; max: number };
  speedRange: { min: number; max: number };
  complexity: number;
};

const DRAG_AVOID: Record<number, NaturalDifficultyProfile> = {
  1: {
    level: 1,
    durationMs: 5500,
    obstacleCount: { min: 2, max: 2 },
    speedRange: { min: 35, max: 55 },
    complexity: 1,
  },
  2: {
    level: 2,
    durationMs: 5000,
    obstacleCount: { min: 3, max: 3 },
    speedRange: { min: 45, max: 70 },
    complexity: 2,
  },
  3: {
    level: 3,
    durationMs: 4500,
    obstacleCount: { min: 3, max: 4 },
    speedRange: { min: 55, max: 85 },
    complexity: 3,
  },
  4: {
    level: 4,
    durationMs: 4200,
    obstacleCount: { min: 4, max: 4 },
    speedRange: { min: 65, max: 95 },
    complexity: 4,
  },
  5: {
    level: 5,
    durationMs: 4000,
    obstacleCount: { min: 4, max: 4 },
    speedRange: { min: 75, max: 110 },
    complexity: 5,
  },
};

const PHYSICAL: Record<number, NaturalDifficultyProfile> = {
  1: {
    level: 1,
    durationMs: 6000,
    obstacleCount: { min: 2, max: 2 },
    speedRange: { min: 40, max: 60 },
    complexity: 1,
  },
  2: {
    level: 2,
    durationMs: 5500,
    obstacleCount: { min: 3, max: 3 },
    speedRange: { min: 50, max: 80 },
    complexity: 2,
  },
  3: {
    level: 3,
    durationMs: 5000,
    obstacleCount: { min: 3, max: 4 },
    speedRange: { min: 60, max: 90 },
    complexity: 3,
  },
  4: {
    level: 4,
    durationMs: 4500,
    obstacleCount: { min: 4, max: 4 },
    speedRange: { min: 70, max: 100 },
    complexity: 4,
  },
  5: {
    level: 5,
    durationMs: 4000,
    obstacleCount: { min: 4, max: 4 },
    speedRange: { min: 80, max: 120 },
    complexity: 5,
  },
};

const DYNAMIC_PATH: Record<number, NaturalDifficultyProfile> = {
  1: {
    level: 1,
    durationMs: 5500,
    obstacleCount: { min: 1, max: 1 },
    speedRange: { min: 30, max: 50 },
    complexity: 1,
  },
  2: {
    level: 2,
    durationMs: 5000,
    obstacleCount: { min: 2, max: 2 },
    speedRange: { min: 40, max: 65 },
    complexity: 2,
  },
  3: {
    level: 3,
    durationMs: 4500,
    obstacleCount: { min: 2, max: 2 },
    speedRange: { min: 50, max: 80 },
    complexity: 3,
  },
  4: {
    level: 4,
    durationMs: 4200,
    obstacleCount: { min: 2, max: 3 },
    speedRange: { min: 60, max: 95 },
    complexity: 4,
  },
  5: {
    level: 5,
    durationMs: 4000,
    obstacleCount: { min: 3, max: 3 },
    speedRange: { min: 70, max: 110 },
    complexity: 5,
  },
};

function clampLevel(level: number): number {
  return Math.min(5, Math.max(1, Math.floor(level)));
}

export function getDragAvoidDifficulty(level: number): NaturalDifficultyProfile {
  return DRAG_AVOID[clampLevel(level)]!;
}

export function getPhysicalDifficulty(level: number): NaturalDifficultyProfile {
  return PHYSICAL[clampLevel(level)]!;
}

export function getDynamicPathDifficulty(
  level: number,
): NaturalDifficultyProfile {
  return DYNAMIC_PATH[clampLevel(level)]!;
}
