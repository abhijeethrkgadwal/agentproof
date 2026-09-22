import type { ChallengeModule } from "@/lib/challenge/core/types";
import {
  ALL_CHALLENGE_TYPES,
  CHALLENGE_META,
} from "@/lib/challenge/core/meta";
import type { ChallengeType, StoredChallenge } from "@/lib/challenge/types";
import { generateTemporalChallenge } from "@/lib/challenge/generator";
import {
  publicPayloadLeaksMotion,
  toFrameResponse,
  toPublicChallenge,
} from "@/lib/challenge/public";
import { validateSelectedObject } from "@/lib/challenge/validator";
import { generateDragAvoidChallenge } from "@/lib/challenge/drag-avoid/generator";
import {
  dragAvoidLeaksHiddenState,
  toDragAvoidFrame,
  toDragAvoidPublic,
  validateDragAvoid,
} from "@/lib/challenge/drag-avoid";
import { generatePhysicalChallenge } from "@/lib/challenge/physical/generator";
import {
  physicalLeaksHiddenState,
  toPhysicalFrame,
  toPhysicalPublic,
  validatePhysical,
} from "@/lib/challenge/physical";
import { generateDynamicPathChallenge } from "@/lib/challenge/dynamic-path/generator";
import {
  dynamicPathLeaksHiddenState,
  toDynamicPathFrame,
  toDynamicPathPublic,
  validateDynamicPath,
} from "@/lib/challenge/dynamic-path";

export { ALL_CHALLENGE_TYPES, CHALLENGE_META };

export const CHALLENGE_MODULES: Record<ChallengeType, ChallengeModule> = {
  temporal: {
    meta: CHALLENGE_META.temporal,
    generate: (opts) => generateTemporalChallenge(opts),
    toPublic: (c, token) => toPublicChallenge(c, token),
    toFrame: (c, elapsed) => toFrameResponse(c, elapsed),
    validate: (c, input) =>
      validateSelectedObject(c, input.selectedObjectId ?? ""),
    leaksHiddenState: publicPayloadLeaksMotion,
  },
  drag_avoid: {
    meta: CHALLENGE_META.drag_avoid,
    generate: (opts) => generateDragAvoidChallenge(opts),
    toPublic: (c, token) => toDragAvoidPublic(c, token),
    toFrame: (c, elapsed) => toDragAvoidFrame(c, elapsed),
    validate: (c, input) => validateDragAvoid(c, input),
    leaksHiddenState: dragAvoidLeaksHiddenState,
  },
  physical: {
    meta: CHALLENGE_META.physical,
    generate: (opts) => generatePhysicalChallenge(opts),
    toPublic: (c, token) => toPhysicalPublic(c, token),
    toFrame: (c, elapsed) => toPhysicalFrame(c, elapsed),
    validate: (c, input) => validatePhysical(c, input),
    leaksHiddenState: physicalLeaksHiddenState,
  },
  dynamic_path: {
    meta: CHALLENGE_META.dynamic_path,
    generate: (opts) => generateDynamicPathChallenge(opts),
    toPublic: (c, token) => toDynamicPathPublic(c, token),
    toFrame: (c, elapsed) => toDynamicPathFrame(c, elapsed),
    validate: (c, input) => validateDynamicPath(c, input),
    leaksHiddenState: dynamicPathLeaksHiddenState,
  },
};

export function getChallengeModule(type: ChallengeType): ChallengeModule {
  return CHALLENGE_MODULES[type];
}

export function generateChallengeByType(
  type: ChallengeType,
  options: {
    difficulty?: number;
    sessionId?: string;
    now?: Date;
    ttlMs?: number;
  } = {},
): StoredChallenge {
  return getChallengeModule(type).generate(options);
}

export function resolveChallengeType(
  value: string | undefined | null,
): ChallengeType {
  if (
    value === "drag_avoid" ||
    value === "physical" ||
    value === "dynamic_path" ||
    value === "temporal"
  ) {
    return value;
  }
  return "temporal";
}
