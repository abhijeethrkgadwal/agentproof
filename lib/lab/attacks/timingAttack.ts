import { labPost, sleep, type HttpJar } from "@/lib/lab/attacks/http";
import { computeAutomationCost, type AttackRunRecord } from "@/lib/lab/types";

/**
 * C. Timing Attack — verify at different fractions of the active window.
 * Measures whether early verification can bypass observation.
 */
export async function runTimingAttack(options: {
  baseUrl: string;
  difficulty?: number;
  fractions?: number[];
}): Promise<Omit<AttackRunRecord, "runId" | "timestamp">> {
  const fractions = options.fractions ?? [0.1, 0.3, 0.5, 0.7, 0.85, 1.0];
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const difficulty = options.difficulty ?? 1;
  const results: string[] = [];
  let anyEarlySuccess = false;
  let totalApi = 0;
  let totalFrames = 0;
  let interactions = 0;
  const t0 = Date.now();
  let lastChallengeId: string | undefined;

  for (const fraction of fractions) {
    const jar: HttpJar = { cookie: "", apiCalls: 0 };
    const issued = await labPost(baseUrl, jar, "/api/challenge", { difficulty });
    if (issued.status !== 200) {
      results.push(`${fraction}:issue_fail`);
      totalApi += jar.apiCalls;
      continue;
    }
    const challenge = issued.json as {
      challengeId: string;
      token: string;
      scene: { durationMs: number; objects: { id: string }[] };
    };
    lastChallengeId = challenge.challengeId;
    interactions += 1;
    await labPost(baseUrl, jar, "/api/challenge/start", {
      challengeId: challenge.challengeId,
      token: challenge.token,
    });

    const waitMs = Math.floor(challenge.scene.durationMs * fraction);
    // Optionally poll a few frames if waiting long enough
    const pollUntil = Date.now() + waitMs;
    while (Date.now() < pollUntil) {
      const frame = await labPost(baseUrl, jar, "/api/challenge/frame", {
        challengeId: challenge.challengeId,
        token: challenge.token,
      });
      if (frame.status === 200) totalFrames += 1;
      await sleep(Math.min(200, Math.max(50, pollUntil - Date.now())));
    }

    interactions += 1;
    const verify = await labPost(baseUrl, jar, "/api/verify", {
      challengeId: challenge.challengeId,
      token: challenge.token,
      selectedObjectId: challenge.scene.objects[0]?.id ?? "object_1",
      telemetry: {
        completionTimeMs: waitMs,
        interactionEventCount: 1,
      },
    });
    totalApi += jar.apiCalls;
    const premature = verify.status === 425;
    const verified =
      verify.status === 200 &&
      (verify.json as { verified?: boolean }).verified === true;
    if (verified && fraction < 0.85) anyEarlySuccess = true;
    results.push(
      `${fraction}:${verify.status}${premature ? ":premature" : verified ? ":ok" : ":fail"}`,
    );
  }

  const solveTimeMs = Date.now() - t0;
  // Success for THIS attack means bypassing observation early — that would be bad.
  // We report success=true only if an early verify was accepted as verified.
  const success = anyEarlySuccess;
  return {
    attackLevel: "lab_v2",
    attackName: "timing_attack",
    challengeDifficulty: difficulty,
    success,
    solveTimeMs,
    frameCount: totalFrames,
    apiRequestCount: totalApi,
    interactionCount: interactions,
    retryCount: 0,
    failureReason: success
      ? null
      : "early_verify_blocked_as_expected",
    automationCost: computeAutomationCost({
      timeToSolveMs: solveTimeMs,
      framesObserved: totalFrames,
      apiRequestCount: totalApi,
      interactionCount: interactions,
    }),
    challengeId: lastChallengeId,
    notes: results.join("|"),
  };
}
