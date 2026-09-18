import type { StoredChallenge } from "@/lib/challenge/types";

export type AnswerValidation =
  | { correct: true }
  | { correct: false; reason: "incorrect_answer" | "unknown_object" };

export function validateSelectedObject(
  challenge: StoredChallenge,
  selectedObjectId: string,
): AnswerValidation {
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
