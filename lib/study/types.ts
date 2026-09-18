/**
 * Human Study — observational pilot types.
 * No PII: anonymous participantId only (no name/email/location/fingerprint).
 */

export type StudyAttempt = {
  attemptId: string;
  participantId: string;
  challengeId: string;
  difficulty: number;
  success: boolean;
  completionTimeMs: number;
  retryCount: number;
  interactionEventCount: number;
  framesObserved: number;
  accessibilityPathUsed: boolean;
  abandoned: boolean;
  timestamp: string;
};

export type StudyAggregate = {
  label: "Observational pilot — not a scientific human-performance study.";
  participantCount: number;
  attempts: number;
  successRate: number;
  medianCompletionTimeMs: number | null;
  p95CompletionTimeMs: number | null;
  abandonmentRate: number;
  medianRetries: number | null;
  medianInteractionEvents: number | null;
};

export type StudyConsentPayload = {
  participantId: string;
  consented: true;
  consentedAt: string;
};
