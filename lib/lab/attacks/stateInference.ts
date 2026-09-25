import { labPost, type HttpJar } from "@/lib/lab/attacks/http";
import { computeAutomationCost, type AttackRunRecord } from "@/lib/lab/types";

/**
 * E. State Inference - inspect client-visible challenge state only;
 * attempt to infer GT without reconstructing the full path.
 */
export async function runStateInference(options: {
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
      attackName: "state_inference",
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

  const payloadText = JSON.stringify(issued.json);
  const hasSegments = payloadText.includes("segments");
  const hasVelocity = payloadText.includes("velocity");
  const hasCorrect = payloadText.includes("correctObjectId");
  const hasGT = payloadText.includes("groundTruth");
  const hasRequiredField = payloadText.includes("requiredDirectionChanges");

  const challenge = issued.json as {
    challengeId: string;
    token: string;
    instruction: string;
    scene: { objects: { id: string; color?: string; shape?: string }[]; durationMs: number };
  };

  // Heuristic-only guess from instruction + object metadata (no frames)
  const required =
    Number(
      (challenge.instruction.match(/exactly\s+(\d+)\s+time/i) || [])[1],
    ) || 2;
  // Naive: pick middle object id - no motion plan available
  const guess =
    challenge.scene.objects[
      Math.min(required, challenge.scene.objects.length - 1)
    ]?.id ?? challenge.scene.objects[0]?.id ?? "object_1";

  interactions += 1;
  await labPost(baseUrl, jar, "/api/challenge/start", {
    challengeId: challenge.challengeId,
    token: challenge.token,
  });

  // Wait full window without using pose trails - pure state/heuristic
  await new Promise((r) => setTimeout(r, challenge.scene.durationMs + 200));

  interactions += 1;
  const verify = await labPost(baseUrl, jar, "/api/verify", {
    challengeId: challenge.challengeId,
    token: challenge.token,
    selectedObjectId: guess,
    telemetry: {
      completionTimeMs: Date.now() - t0,
      interactionEventCount: 1,
    },
  });

  const success =
    verify.status === 200 && (verify.json as { verified?: boolean }).verified === true;
  const leaked =
    hasSegments || hasVelocity || hasCorrect || hasGT || hasRequiredField;
  const solveTimeMs = Date.now() - t0;

  return {
    attackLevel: "lab_v2",
    attackName: "state_inference",
    challengeDifficulty: difficulty,
    success: success || leaked,
    solveTimeMs,
    frameCount: 0,
    apiRequestCount: jar.apiCalls,
    interactionCount: interactions,
    retryCount: 0,
    failureReason:
      success || leaked
        ? null
        : `no_leak_guess_failed status=${verify.status}`,
    automationCost: computeAutomationCost({
      timeToSolveMs: solveTimeMs,
      framesObserved: 0,
      apiRequestCount: jar.apiCalls,
      interactionCount: interactions,
    }),
    challengeId: challenge.challengeId,
    notes: `leaked=${leaked}; guess=${guess}; keys=${Object.keys(issued.json).join(",")}`,
  };
}
