"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TemporalChallenge } from "@/components/agentproof/TemporalChallenge";
import {
  VerificationResult,
  type VerificationPayload,
} from "@/components/agentproof/VerificationResult";
import type {
  FrameResponse,
  ObjectPose,
  PublicChallengeResponse,
} from "@/lib/challenge/types";
import type { TelemetryEvent } from "@/lib/telemetry/events";

type LoadState = "loading" | "issued" | "active" | "error";

export function Challenge({
  difficulty = 1,
}: {
  difficulty?: 1 | 2;
}) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<PublicChallengeResponse | null>(
    null,
  );
  const [poses, setPoses] = useState<ObjectPose[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [complete, setComplete] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [interactionCount, setInteractionCount] = useState(0);
  const [verifyStatus, setVerifyStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<VerificationPayload | null>(null);

  const pushEvent = useCallback(
    (eventType: TelemetryEvent["eventType"], extra?: Partial<TelemetryEvent>) => {
      setEvents((prev) => [
        ...prev,
        {
          eventType,
          timestamp: new Date().toISOString(),
          relativeTimeMs: startedAt ? Date.now() - startedAt : 0,
          challengeId: challenge?.challengeId,
          ...extra,
        },
      ]);
    },
    [challenge?.challengeId, startedAt],
  );

  const loadChallenge = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    setSelectedObjectId(null);
    setResult(null);
    setVerifyStatus("idle");
    setEvents([]);
    setStartedAt(null);
    setInteractionCount(0);
    setPoses([]);
    setElapsedMs(0);
    setComplete(false);

    try {
      const response = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ difficulty }),
      });
      const data = (await response.json()) as PublicChallengeResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create challenge");
      }
      if ("groundTruth" in data) {
        delete (data as Record<string, unknown>).groundTruth;
      }
      setChallenge(data);
      setLoadState("issued");
      setEvents([
        {
          eventType: "challenge_created",
          timestamp: new Date().toISOString(),
          relativeTimeMs: 0,
          challengeId: data.challengeId,
        },
      ]);
    } catch (err) {
      setLoadState("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [difficulty]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount fetch
    void loadChallenge();
  }, [loadChallenge]);

  const startChallenge = async () => {
    if (!challenge) return;
    setError(null);
    try {
      const response = await fetch("/api/challenge/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          token: challenge.token,
        }),
      });
      const data = (await response.json()) as FrameResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to start challenge");
      }
      setPoses(data.poses);
      setElapsedMs(data.elapsedMs);
      setComplete(data.complete);
      setStartedAt(Date.now());
      setLoadState("active");
      pushEvent("challenge_started");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start failed");
    }
  };

  // Progressive frame polling while active (server clock)
  useEffect(() => {
    if (loadState !== "active" || !challenge || complete) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/challenge/frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            challengeId: challenge.challengeId,
            token: challenge.token,
          }),
        });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as FrameResponse;
        if (cancelled) return;
        setPoses(data.poses);
        setElapsedMs(data.elapsedMs);
        if (data.complete) setComplete(true);
      } catch {
        // ignore transient poll errors
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), 120);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [loadState, challenge, complete]);

  const onSelect = (objectId: string) => {
    if (!complete && loadState === "active") {
      // Allow select during/after watch; verify still enforces min active window
    }
    setSelectedObjectId(objectId);
    setInteractionCount((count) => count + 1);
    pushEvent("object_selected", { objectId });
  };

  const onVerify = async () => {
    if (!challenge || !selectedObjectId) return;
    setVerifyStatus("loading");
    pushEvent("verification_requested");

    const completionTimeMs = startedAt ? Date.now() - startedAt : 0;
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          token: challenge.token,
          selectedObjectId,
          telemetry: {
            completionTimeMs,
            interactionEventCount: interactionCount + 1,
            retryCount: 0,
            startedAt: startedAt ? new Date(startedAt).toISOString() : undefined,
            events: [
              ...events,
              {
                eventType: "verification_requested" as const,
                timestamp: new Date().toISOString(),
                relativeTimeMs: completionTimeMs,
                challengeId: challenge.challengeId,
              },
            ],
          },
        }),
      });
      const data = (await response.json()) as VerificationPayload & {
        error?: string;
      };

      if (!response.ok) {
        setVerifyStatus("error");
        setResult({
          verified: false,
          decision: "restrict",
          riskScore: 1,
          confidence: 0.5,
          band: "HIGH",
          challengeId: challenge.challengeId,
          error: data.error ?? `HTTP ${response.status}`,
        });
        pushEvent("challenge_failed");
        return;
      }

      setResult(data);
      setVerifyStatus("success");
      pushEvent(data.verified ? "challenge_completed" : "challenge_failed");
    } catch (err) {
      setVerifyStatus("error");
      setResult({
        verified: false,
        decision: "restrict",
        riskScore: 1,
        confidence: 0.2,
        band: "HIGH",
        challengeId: challenge.challengeId,
        error: err instanceof Error ? err.message : "network_error",
      });
    }
  };

  const durationMs = challenge?.scene.durationMs ?? 0;
  const progress = durationMs ? Math.min(1, elapsedMs / durationMs) : 0;

  return (
    <div className="space-y-6" data-testid="challenge-widget">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">
            Temporal research challenge
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-50">
            Watch, then select
          </h2>
          <p
            className="mt-2 max-w-xl text-slate-300"
            data-testid="challenge-instruction"
          >
            {challenge?.instruction ?? "Loading challenge…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/demo/accessible"
            className="min-h-10 rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Keyboard / list
          </Link>
          <button
            type="button"
            onClick={() => void loadChallenge()}
            className="min-h-10 rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
            data-testid="reload-challenge"
          >
            New challenge
          </button>
        </div>
      </div>

      {loadState === "loading" ? (
        <div className="flex h-64 items-center justify-center rounded-md border border-slate-800 bg-slate-950/50 text-slate-400">
          Generating challenge…
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="rounded-md border border-rose-900/50 bg-rose-950/20 p-4 text-rose-300">
          {error}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => void loadChallenge()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {error && loadState !== "error" ? (
        <p className="text-sm text-rose-300" data-testid="inline-error">
          {error}
        </p>
      ) : null}

      {challenge && (loadState === "issued" || loadState === "active") ? (
        <>
          {loadState === "issued" ? (
            <div className="flex flex-col items-start gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-5 sm:p-6">
              <p className="text-slate-300">
                Challenge ready. Press start to watch the objects move - the
                answer stays on the server until you verify.
              </p>
              <p className="text-xs text-slate-500">
                Prefer a keyboard list instead of this canvas?{" "}
                <Link href="/demo/accessible" className="text-cyan-400 hover:underline">
                  Open accessible mode
                </Link>
                .
              </p>
              <button
                type="button"
                data-testid="start-challenge"
                onClick={() => void startChallenge()}
                className="min-h-11 rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Start watching
              </button>
            </div>
          ) : null}

          {loadState === "active" ? (
            <>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                <span data-testid="elapsed-label">
                  {(elapsedMs / 1000).toFixed(1)}s / {(durationMs / 1000).toFixed(1)}s
                </span>
                <span>{complete ? "Observation complete" : "Watching…"}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-cyan-400 transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <TemporalChallenge
                scene={challenge.scene}
                poses={poses}
                selectedObjectId={selectedObjectId}
                onSelect={onSelect}
                interactive={true}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-testid="verify-button"
                  disabled={!selectedObjectId || verifyStatus === "loading"}
                  onClick={() => void onVerify()}
                  className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Verify
                </button>
                <span
                  className="text-sm text-slate-400"
                  data-testid="selection-label"
                >
                  {selectedObjectId
                    ? `Selected: ${selectedObjectId}`
                    : "No object selected"}
                </span>
              </div>
            </>
          ) : null}
        </>
      ) : null}

      <VerificationResult status={verifyStatus} result={result} />
    </div>
  );
}
