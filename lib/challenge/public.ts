import type {
  PublicChallengeResponse,
  StoredChallenge,
} from "@/lib/challenge/types";

/**
 * Map a stored challenge to the client-safe API shape.
 * Ground truth is intentionally omitted — never send it to the browser.
 */
export function toPublicChallenge(
  challenge: StoredChallenge,
  token: string,
): PublicChallengeResponse {
  return {
    challengeId: challenge.challengeId,
    token,
    challengeType: challenge.challengeType,
    sessionId: challenge.sessionId,
    renderConfiguration: challenge.renderConfiguration,
    expiresAt: challenge.expiresAt,
    difficulty: challenge.difficulty,
    instruction: challenge.renderConfiguration.instruction,
  };
}
