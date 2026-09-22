import type { InteractionPayload } from "@/lib/challenge/core/types";
import type { StoredChallenge } from "@/lib/challenge/types";
import { isTemporalChallenge } from "@/lib/challenge/types";
import { validateDragAvoid } from "@/lib/challenge/drag-avoid";
import { validatePhysical } from "@/lib/challenge/physical";
import { validateDynamicPath } from "@/lib/challenge/dynamic-path";

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

export function validateSelectedObject(
  challenge: StoredChallenge,
  selectedObjectId: string,
): AnswerValidation {
  if (!isTemporalChallenge(challenge)) {
    return { correct: false, reason: "incorrect_answer" };
  }
  const ids = new Set(
    challenge.renderConfiguration.objects.map((object) => object.id),
  );
  if (!ids.has(selectedObjectId)) {
    return { correct: false, reason: "unknown_object" };
  }
  if (selectedObjectId !== challenge.groundTruth.correctObjectId) {
    return { correct: false, reason: "incorrect_answer" };
  }
  return { correct: true };
}

export function validateChallengeAnswer(
  challenge: StoredChallenge,
  input: {
    selectedObjectId?: string;
    interaction?: InteractionPayload;
  },
): AnswerValidation {
  switch (challenge.challengeType) {
    case "drag_avoid":
      return validateDragAvoid(challenge, input);
    case "physical":
      return validatePhysical(challenge, input);
    case "dynamic_path":
      return validateDynamicPath(challenge, input);
    case "temporal":
    default:
      return validateSelectedObject(challenge, input.selectedObjectId ?? "");
  }
}
