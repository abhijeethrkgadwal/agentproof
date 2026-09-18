import {
  computeAutomationCost,
  type LabRunRecord,
} from "@/lib/lab/types";
import {
  deriveFromPoseTrails,
  parseRequiredChanges,
  type PoseSample,
} from "@/lib/lab/poseTrail";

export type L1RunOptions = {
  baseUrl: string;
  difficulty?: number;
  pollIntervalMs?: number;
  cookieJar?: Map<string, string>;
};

function parseSetCookie(headers: Headers): string | undefined {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    const list = anyHeaders.getSetCookie();
    if (list.length) return list.map((c) => c.split(";")[0]).join("; ");
  }
  const single = headers.get("set-cookie");
  if (single) return single.split(";")[0];
  return undefined;
}

/**
 * Level 1 — API observer: start → poll frames → reconstruct trail → verify.
 * Does not modify the Phase 3 protocol; uses public APIs only.
 */
export async function runL1ApiObserver(
  options: L1RunOptions,
): Promise<Omit<LabRunRecord, "runId" | "createdAt">> {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const difficulty = options.difficulty ?? 1;
  const pollIntervalMs = options.pollIntervalMs ?? 120;
  let apiCalls = 0;
  let framesObserved = 0;
  let actions = 0;
  let cookie = "";
  const t0 = Date.now();

  const post = async (path: string, body: unknown) => {
    apiCalls += 1;
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    const set = parseSetCookie(res.headers);
    if (set) cookie = set;
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  };

  try {
    const issued = await post("/api/challenge", { difficulty });
    if (issued.status !== 200) {
      return {
        level: "l1_api_observer",
        difficulty,
        status: "error",
        success: false,
        timeToSolveMs: Date.now() - t0,
        apiCalls,
        framesObserved,
        actions,
        automationCost: computeAutomationCost({
          timeToSolveMs: Date.now() - t0,
          actions,
          framesObserved,
          apiCalls,
        }),
        verificationResult: { error: issued.json.error, status: issued.status },
        notes: "challenge_issue_failed",
      };
    }

    const challenge = issued.json as {
      challengeId: string;
      token: string;
      instruction: string;
      scene: { durationMs: number; objects: { id: string }[] };
    };

    actions += 1; // start
    const started = await post("/api/challenge/start", {
      challengeId: challenge.challengeId,
      token: challenge.token,
    });
    if (started.status !== 200) {
      return {
        level: "l1_api_observer",
        difficulty,
        challengeId: challenge.challengeId,
        status: "error",
        success: false,
        timeToSolveMs: Date.now() - t0,
        apiCalls,
        framesObserved,
        actions,
        automationCost: computeAutomationCost({
          timeToSolveMs: Date.now() - t0,
          actions,
          framesObserved,
          apiCalls,
        }),
        verificationResult: { error: started.json.error, status: started.status },
        notes: "start_failed",
      };
    }

    const trails: Record<string, PoseSample[]> = {};
    let complete = false;
    const deadline = Date.now() + challenge.scene.durationMs + 1500;

    while (!complete && Date.now() < deadline) {
      const frame = await post("/api/challenge/frame", {
        challengeId: challenge.challengeId,
        token: challenge.token,
      });
      if (frame.status === 200 && Array.isArray(frame.json.poses)) {
        framesObserved += 1;
        const elapsed = Number(frame.json.elapsedMs ?? 0);
        for (const pose of frame.json.poses as {
          id: string;
          x: number;
          y: number;
        }[]) {
          if (!trails[pose.id]) trails[pose.id] = [];
          trails[pose.id]!.push({ t: elapsed, x: pose.x, y: pose.y });
        }
        complete = Boolean(frame.json.complete);
      }
      if (!complete) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
    }

    const required =
      parseRequiredChanges(challenge.instruction) ??
      2;
    const derived = deriveFromPoseTrails(trails, required);
    if (!derived.ok && !("objectId" in derived)) {
      return {
        level: "l1_api_observer",
        difficulty,
        challengeId: challenge.challengeId,
        status: "failure",
        success: false,
        timeToSolveMs: Date.now() - t0,
        apiCalls,
        framesObserved,
        actions,
        automationCost: computeAutomationCost({
          timeToSolveMs: Date.now() - t0,
          actions,
          framesObserved,
          apiCalls,
        }),
        notes: `derive_failed:${derived.error}`,
      };
    }

    const objectId =
      "objectId" in derived && derived.ok
        ? derived.objectId
        : (derived as { objectId?: string }).objectId ??
          challenge.scene.objects[0]!.id;

    actions += 1; // verify
    const verify = await post("/api/verify", {
      challengeId: challenge.challengeId,
      token: challenge.token,
      selectedObjectId: objectId,
      telemetry: {
        completionTimeMs: Date.now() - t0,
        interactionEventCount: framesObserved,
        events: [],
      },
    });

    const success = verify.status === 200 && verify.json.verified === true;
    const timeToSolveMs = Date.now() - t0;

    return {
      level: "l1_api_observer",
      difficulty,
      challengeId: challenge.challengeId,
      status: success ? "success" : "failure",
      success,
      timeToSolveMs,
      apiCalls,
      framesObserved,
      actions,
      automationCost: computeAutomationCost({
        timeToSolveMs,
        actions,
        framesObserved,
        apiCalls,
      }),
      verificationResult: {
        verified: verify.json.verified,
        decision: verify.json.decision,
        riskScore: verify.json.riskScore,
        error: verify.json.error,
        status: verify.status,
      },
      notes: `derived=${objectId}; counts=${JSON.stringify(derived.counts)}; required=${required}`,
    };
  } catch (error) {
    const timeToSolveMs = Date.now() - t0;
    return {
      level: "l1_api_observer",
      difficulty,
      status: "error",
      success: false,
      timeToSolveMs,
      apiCalls,
      framesObserved,
      actions,
      automationCost: computeAutomationCost({
        timeToSolveMs,
        actions,
        framesObserved,
        apiCalls,
      }),
      notes: error instanceof Error ? error.message : "unknown_error",
    };
  }
}
