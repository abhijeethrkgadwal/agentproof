export type DifficultyProfile = {
  level: number;
  objectCount: { min: number; max: number };
  durationMs: number;
  maxDirectionChanges: number;
  distractorJitter: number;
  speedRange: { min: number; max: number };
};

const PROFILES: Record<number, DifficultyProfile> = {
  1: {
    level: 1,
    objectCount: { min: 6, max: 7 },
    durationMs: 5000,
    maxDirectionChanges: 2,
    distractorJitter: 0.15,
    speedRange: { min: 40, max: 80 },
  },
  2: {
    level: 2,
    objectCount: { min: 7, max: 9 },
    durationMs: 4500,
    maxDirectionChanges: 2,
    distractorJitter: 0.25,
    speedRange: { min: 50, max: 100 },
  },
  3: {
    level: 3,
    objectCount: { min: 8, max: 10 },
    durationMs: 4000,
    maxDirectionChanges: 3,
    distractorJitter: 0.35,
    speedRange: { min: 60, max: 120 },
  },
  4: {
    level: 4,
    objectCount: { min: 9, max: 10 },
    durationMs: 3500,
    maxDirectionChanges: 3,
    distractorJitter: 0.45,
    speedRange: { min: 70, max: 140 },
  },
  5: {
    level: 5,
    objectCount: { min: 10, max: 10 },
    durationMs: 3000,
    maxDirectionChanges: 4,
    distractorJitter: 0.55,
    speedRange: { min: 80, max: 160 },
  },
};

export function getDifficultyProfile(level: number): DifficultyProfile {
  const clamped = Math.min(5, Math.max(1, Math.floor(level)));
  return PROFILES[clamped]!;
}

/** UI enables only difficulty 1–2 in Phase 1. */
export function isUiEnabledDifficulty(level: number): boolean {
  return level === 1 || level === 2;
}
