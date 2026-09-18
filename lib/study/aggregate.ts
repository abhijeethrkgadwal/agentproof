import { median, p95, successRate } from "@/lib/lab/metrics";
import type { StudyAggregate, StudyAttempt } from "@/lib/study/types";

export function aggregateStudyAttempts(attempts: StudyAttempt[]): StudyAggregate {
  const participants = new Set(attempts.map((a) => a.participantId));
  const completed = attempts.filter((a) => !a.abandoned);
  const successes = completed.filter((a) => a.success);
  const abandoned = attempts.filter((a) => a.abandoned);

  return {
    label: "Observational pilot — not a scientific human-performance study.",
    participantCount: participants.size,
    attempts: attempts.length,
    successRate: successRate(successes.length, completed.length),
    medianCompletionTimeMs: median(
      successes.map((a) => a.completionTimeMs),
    ),
    p95CompletionTimeMs: p95(successes.map((a) => a.completionTimeMs)),
    abandonmentRate: successRate(abandoned.length, attempts.length),
    medianRetries: median(completed.map((a) => a.retryCount)),
    medianInteractionEvents: median(
      completed.map((a) => a.interactionEventCount),
    ),
  };
}
