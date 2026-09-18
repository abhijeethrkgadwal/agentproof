import { deriveAdaptive } from "@/lib/lab/attacks/adaptiveTrail";
import { labPost, sleep, type HttpJar } from "@/lib/lab/attacks/http";
import { computeAutomationCost, type AttackRunRecord } from "@/lib/lab/types";
import type { PoseSample } from "@/lib/lab/poseTrail";

/**
 * A. Frame Reconstruction v2 — adaptive smoothing + path reconstruction
 * against display-hardened /frame poses.
 */
export async function runFrameReconstructionV2(options: {
  baseUrl: string;
  difficulty?: number;
}): Promise<Omit<AttackRunRecord, "runId" | "timestamp">> {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const difficulty = options.difficulty ?? 1;
  const jar: HttpJar = { cookie: "", apiCalls: 0 };
  let frames = 0;
  let interactions = 0;
  const t0 = Date.now();

  const issued = await labPost(baseUrl, jar, "/api/challenge", { difficulty });
  if (issued.status !== 200) {
    return fail("challenge_issue_failed", difficulty, jar, frames, interactions, t0);
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
  const deadline = Date.now() + (challenge.scene.durationMs ?? 5000) + 1500;
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
    if (!complete) await sleep(100);
  }

  const requiredMatch = challenge.instruction.match(/exactly\s+(\d+)\s+time/i);
  const required = requiredMatch ? Number(requiredMatch[1]) : 2;
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
    attackName: "frame_reconstruction_v2",
    challengeDifficulty: difficulty,
    success,
    solveTimeMs,
    frameCount: frames,
    apiRequestCount: jar.apiCalls,
    interactionCount: interactions,
    retryCount: 0,
    failureReason: success
      ? null
      : `verify_${verify.status}_${(verify.json as { error?: string }).error ?? "wrong"}`,
    automationCost: computeAutomationCost({
      timeToSolveMs: solveTimeMs,
      framesObserved: frames,
      apiRequestCount: jar.apiCalls,
      interactionCount: interactions,
    }),
    challengeId: challenge.challengeId,
    notes: `counts=${JSON.stringify(derived.counts)}; picked=${derived.objectId}; required=${required}`,
  };
}

function fail(
  reason: string,
  difficulty: number,
  jar: HttpJar,
  frames: number,
  interactions: number,
  t0: number,
): Omit<AttackRunRecord, "runId" | "timestamp"> {
  const solveTimeMs = Date.now() - t0;
  return {
    attackLevel: "lab_v2",
    attackName: "frame_reconstruction_v2",
    challengeDifficulty: difficulty,
    success: false,
    solveTimeMs,
    frameCount: frames,
    apiRequestCount: jar.apiCalls,
    interactionCount: interactions,
    retryCount: 0,
    failureReason: reason,
    automationCost: computeAutomationCost({
      timeToSolveMs: solveTimeMs,
      framesObserved: frames,
      apiRequestCount: jar.apiCalls,
      interactionCount: interactions,
    }),
  };
}
