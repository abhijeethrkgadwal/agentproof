import { labPost, sleep, type HttpJar } from "@/lib/lab/attacks/http";
import { computeAutomationCost, type AttackRunRecord } from "@/lib/lab/types";

/**
 * F. Replay / Tampering — confirm replay and signature tamper remain blocked.
 * success=true means the attacker bypassed protections (regression).
 */
export async function runReplayTampering(options: {
  baseUrl: string;
  difficulty?: number;
}): Promise<Omit<AttackRunRecord, "runId" | "timestamp">> {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const difficulty = options.difficulty ?? 1;
  const jar: HttpJar = { cookie: "", apiCalls: 0 };
  let frames = 0;
  let interactions = 0;
  const t0 = Date.now();
  const notes: string[] = [];

  // --- Replay ---
  const issued = await labPost(baseUrl, jar, "/api/challenge", { difficulty });
  const challenge = issued.json as {
    challengeId: string;
    token: string;
    scene: { durationMs: number; objects: { id: string }[] };
  };
  interactions += 1;
  await labPost(baseUrl, jar, "/api/challenge/start", {
    challengeId: challenge.challengeId,
    token: challenge.token,
  });
  const wait = Math.floor(challenge.scene.durationMs * 0.9);
  const until = Date.now() + wait;
  while (Date.now() < until) {
    const frame = await labPost(baseUrl, jar, "/api/challenge/frame", {
      challengeId: challenge.challengeId,
      token: challenge.token,
    });
    if (frame.status === 200) frames += 1;
    await sleep(150);
  }
  interactions += 1;
  const first = await labPost(baseUrl, jar, "/api/verify", {
    challengeId: challenge.challengeId,
    token: challenge.token,
    selectedObjectId: challenge.scene.objects[0]?.id ?? "object_1",
    telemetry: { completionTimeMs: wait, interactionEventCount: 2 },
  });
  const replay = await labPost(baseUrl, jar, "/api/verify", {
    challengeId: challenge.challengeId,
    token: challenge.token,
    selectedObjectId: challenge.scene.objects[0]?.id ?? "object_1",
    telemetry: {},
  });
  const replayBypass = replay.status === 200;
  notes.push(`replay first=${first.status} second=${replay.status}`);

  // --- Tamper ---
  const jar2: HttpJar = { cookie: "", apiCalls: 0 };
  const c2 = await labPost(baseUrl, jar2, "/api/challenge", { difficulty });
  const challenge2 = c2.json as { challengeId: string; token: string };
  const badSig = `${String(challenge2.token).split(".")[0]}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
  interactions += 1;
  const tamper = await labPost(baseUrl, jar2, "/api/verify", {
    challengeId: challenge2.challengeId,
    token: badSig,
    selectedObjectId: "object_1",
  });
  const tamperBypass = tamper.status === 200;
  notes.push(`tamper=${tamper.status}`);

  const totalApi = jar.apiCalls + jar2.apiCalls;
  const success = replayBypass || tamperBypass;
  const solveTimeMs = Date.now() - t0;

  return {
    attackLevel: "lab_v2",
    attackName: "replay_tampering",
    challengeDifficulty: difficulty,
    success,
    solveTimeMs,
    frameCount: frames,
    apiRequestCount: totalApi,
    interactionCount: interactions,
    retryCount: 1,
    failureReason: success
      ? null
      : "replay_and_tamper_blocked_as_expected",
    automationCost: computeAutomationCost({
      timeToSolveMs: solveTimeMs,
      framesObserved: frames,
      apiRequestCount: totalApi,
      interactionCount: interactions,
    }),
    challengeId: challenge.challengeId,
    notes: notes.join("; "),
  };
}
