import { labPost, type HttpJar } from "@/lib/lab/attacks/http";
import { computeAutomationCost, type AttackRunRecord } from "@/lib/lab/types";

/**
 * D. Direct API Attack — solve entirely through HTTP, no visual UI.
 * Attempts issued-only verify and post-start guess without trail math.
 */
export async function runDirectApiAttack(options: {
  baseUrl: string;
  difficulty?: number;
}): Promise<Omit<AttackRunRecord, "runId" | "timestamp">> {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const difficulty = options.difficulty ?? 1;
  const jar: HttpJar = { cookie: "", apiCalls: 0 };
  let interactions = 0;
  const t0 = Date.now();

  const issued = await labPost(baseUrl, jar, "/api/challenge", { difficulty });
  if (issued.status !== 200) {
    return {
      attackLevel: "lab_v2",
      attackName: "direct_api_attack",
      challengeDifficulty: difficulty,
      success: false,
      solveTimeMs: Date.now() - t0,
      frameCount: 0,
      apiRequestCount: jar.apiCalls,
      interactionCount: 0,
      retryCount: 0,
      failureReason: "challenge_issue_failed",
      automationCost: computeAutomationCost({
        timeToSolveMs: Date.now() - t0,
        framesObserved: 0,
        apiRequestCount: jar.apiCalls,
        interactionCount: 0,
      }),
    };
  }

  const challenge = issued.json as {
    challengeId: string;
    token: string;
    scene: { objects: { id: string }[]; durationMs: number };
  };

  // Attempt 1: verify without start (should fail)
  interactions += 1;
  const early = await labPost(baseUrl, jar, "/api/verify", {
    challengeId: challenge.challengeId,
    token: challenge.token,
    selectedObjectId: challenge.scene.objects[0]?.id ?? "object_1",
    telemetry: { completionTimeMs: 1, interactionEventCount: 0 },
  });

  // Attempt 2: start then immediate guess first object (no frames)
  interactions += 1;
  await labPost(baseUrl, jar, "/api/challenge/start", {
    challengeId: challenge.challengeId,
    token: challenge.token,
  });
  const immediate = await labPost(baseUrl, jar, "/api/verify", {
    challengeId: challenge.challengeId,
    token: challenge.token,
    selectedObjectId: challenge.scene.objects[0]?.id ?? "object_1",
    telemetry: { completionTimeMs: 10, interactionEventCount: 0 },
  });

  const earlyOk =
    early.status === 200 && (early.json as { verified?: boolean }).verified === true;
  const immOk =
    immediate.status === 200 &&
    (immediate.json as { verified?: boolean }).verified === true;
  const success = earlyOk || immOk;
  const solveTimeMs = Date.now() - t0;

  return {
    attackLevel: "lab_v2",
    attackName: "direct_api_attack",
    challengeDifficulty: difficulty,
    success,
    solveTimeMs,
    frameCount: 0,
    apiRequestCount: jar.apiCalls,
    interactionCount: interactions,
    retryCount: 1,
    failureReason: success
      ? null
      : `blocked early=${early.status} immediate=${immediate.status}`,
    automationCost: computeAutomationCost({
      timeToSolveMs: solveTimeMs,
      framesObserved: 0,
      apiRequestCount: jar.apiCalls,
      interactionCount: interactions,
    }),
    challengeId: challenge.challengeId,
    notes: `early=${early.status}; immediate=${immediate.status}/${(immediate.json as { error?: string }).error ?? ""}`,
  };
}
