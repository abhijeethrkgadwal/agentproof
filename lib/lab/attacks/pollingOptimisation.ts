import { deriveAdaptive } from "@/lib/lab/attacks/adaptiveTrail";
import { labPost, sleep, type HttpJar } from "@/lib/lab/attacks/http";
import { computeAutomationCost, type AttackRunRecord } from "@/lib/lab/types";
import type { PoseSample } from "@/lib/lab/poseTrail";

/**
 * B. Polling Optimisation - try multiple poll intervals; pick cheapest success.
 */
export async function runPollingOptimisation(options: {
  baseUrl: string;
  difficulty?: number;
  intervalsMs?: number[];
}): Promise<Omit<AttackRunRecord, "runId" | "timestamp">> {
  const intervals = options.intervalsMs ?? [80, 150, 250, 400, 600];
  const trials: Array<Omit<AttackRunRecord, "runId" | "timestamp">> = [];

  for (const interval of intervals) {
    trials.push(
      await once(options.baseUrl, options.difficulty ?? 1, interval),
    );
  }

  const successes = trials.filter((t) => t.success);
  if (successes.length === 0) {
    const cheapestFail = [...trials].sort(
      (a, b) => a.automationCost - b.automationCost,
    )[0]!;
    return {
      ...cheapestFail,
      attackName: "polling_optimisation",
      notes: `no_success; tried intervals=${intervals.join(",")}; costs=${trials
        .map((t) => t.automationCost)
        .join(",")}`,
      failureReason: "no_interval_succeeded",
    };
  }

  const best = [...successes].sort(
    (a, b) => a.automationCost - b.automationCost,
  )[0]!;
  return {
    ...best,
    attackName: "polling_optimisation",
    notes: `bestIntervalCost=${best.automationCost}; tried=${intervals.join(",")}; successCount=${successes.length}/${trials.length}`,
  };
}

async function once(
  baseUrlRaw: string,
  difficulty: number,
  pollIntervalMs: number,
): Promise<Omit<AttackRunRecord, "runId" | "timestamp">> {
  const baseUrl = baseUrlRaw.replace(/\/$/, "");
  const jar: HttpJar = { cookie: "", apiCalls: 0 };
  let frames = 0;
  let interactions = 0;
  const t0 = Date.now();

  const issued = await labPost(baseUrl, jar, "/api/challenge", { difficulty });
  if (issued.status !== 200) {
    return {
      attackLevel: "lab_v2",
      attackName: "polling_optimisation",
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
    instruction: string;
    scene: { durationMs: number };
  };
  interactions += 1;
  await labPost(baseUrl, jar, "/api/challenge/start", {
    challengeId: challenge.challengeId,
    token: challenge.token,
  });

  const trails: Record<string, PoseSample[]> = {};
  let complete = false;
  const deadline = Date.now() + challenge.scene.durationMs + 1500;
  while (!complete && Date.now() < deadline) {
    const frame = await labPost(baseUrl, jar, "/api/challenge/frame", {
      challengeId: challenge.challengeId,
      token: challenge.token,
    });
    if (frame.status === 200) {
      frames += 1;
      const poses = (frame.json.poses as Array<{
        id: string;
        x: number;
        y: number;
      }>) ?? [];
      const elapsed = Number(frame.json.elapsedMs ?? 0);
      for (const pose of poses) {
        if (!trails[pose.id]) trails[pose.id] = [];
        trails[pose.id]!.push({ t: elapsed, x: pose.x, y: pose.y });
      }
      complete = Boolean(frame.json.complete);
    }
    if (!complete) await sleep(pollIntervalMs);
  }

  const required =
    Number(
      (challenge.instruction.match(/exactly\s+(\d+)\s+time/i) || [])[1],
    ) || 2;
  const derived = deriveAdaptive(trails, required);
  interactions += 1;
  const verify = await labPost(baseUrl, jar, "/api/verify", {
    challengeId: challenge.challengeId,
    token: challenge.token,
    selectedObjectId: derived.objectId,
    telemetry: {
      completionTimeMs: Date.now() - t0,
      interactionEventCount: frames,
    },
  });
  const success =
    verify.status === 200 && (verify.json as { verified?: boolean }).verified === true;
  const solveTimeMs = Date.now() - t0;
  return {
    attackLevel: "lab_v2",
    attackName: "polling_optimisation",
    challengeDifficulty: difficulty,
    success,
    solveTimeMs,
    frameCount: frames,
    apiRequestCount: jar.apiCalls,
    interactionCount: interactions,
    retryCount: 0,
    failureReason: success ? null : `interval_${pollIntervalMs}_failed`,
    automationCost: computeAutomationCost({
      timeToSolveMs: solveTimeMs,
      framesObserved: frames,
      apiRequestCount: jar.apiCalls,
      interactionCount: interactions,
    }),
    challengeId: challenge.challengeId,
    notes: `intervalMs=${pollIntervalMs}`,
  };
}
