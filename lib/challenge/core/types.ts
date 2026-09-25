/**
 * Shared challenge architecture (AgentProof v0.2).
 * Each challenge module implements generator / public DTO / frame / validator.
 */

import type { ChallengeType, StoredChallenge, Vec2 } from "@/lib/challenge/types";

export type ChallengeDifficulty = 1 | 2 | 3 | 4 | 5;

export type AccessibilityStrategy = {
  /** Short description of the equivalent non-drag task. */
  summary: string;
  /** Pilot disclaimer - not WCAG-certified. */
  disclaimer: string;
  mode: "keyboard_sequence" | "structured_input" | "temporal_select";
};

export type ChallengeModuleMeta = {
  type: ChallengeType;
  label: string;
  shortDescription: string;
  instructionDefault: string;
  accessibility: AccessibilityStrategy;
  /** Whether this type uses progressive frame polling. */
  usesFrames: boolean;
};

/** Pointer / touch sample submitted at verify for interaction challenges. */
export type InteractionSample = {
  t: number;
  x: number;
  y: number;
  objectId?: string;
  kind?: "move" | "down" | "up" | "collision";
};

export type InteractionPayload = {
  samples: InteractionSample[];
  finalPositions?: Record<string, Vec2 & { rotation?: number }>;
  accessibleAnswers?: Record<string, string | number>;
};

export type AnswerValidation =
  | { correct: true }
  | {
      correct: false;
      reason:
        | "incorrect_answer"
        | "unknown_object"
        | "incorrect_object"
        | "collision"
        | "missed_target"
        | "invalid_trajectory"
        | "invalid_start"
        | "protected_displaced"
        | "incorrect_orientation"
        | "gate_collision"
        | "incomplete_path"
        | "invalid_accessible_answer";
    };

export type ChallengeGeneratorFn = (options: {
  difficulty?: number;
  sessionId?: string;
  now?: Date;
  ttlMs?: number;
}) => StoredChallenge;

export type ChallengePublicFn = (
  challenge: StoredChallenge,
  token: string,
) => unknown;

export type ChallengeFrameFn = (
  challenge: StoredChallenge,
  elapsedMs: number,
) => unknown;

export type ChallengeValidateFn = (
  challenge: StoredChallenge,
  input: {
    selectedObjectId?: string;
    interaction?: InteractionPayload;
  },
) => AnswerValidation;

export type ChallengeModule = {
  meta: ChallengeModuleMeta;
  generate: ChallengeGeneratorFn;
  toPublic: ChallengePublicFn;
  toFrame: ChallengeFrameFn;
  validate: ChallengeValidateFn;
  /** True if public JSON leaks future plans / GT. Used by audits. */
  leaksHiddenState: (payload: unknown) => boolean;
};
