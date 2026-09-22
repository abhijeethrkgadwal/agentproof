"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  VerificationResult,
  type VerificationPayload,
} from "@/components/agentproof/VerificationResult";
import type {
  ChallengeType,
  FrameResponse,
  ObjectPose,
  PublicChallengeResponse,
} from "@/lib/challenge/types";
import type { InteractionSample } from "@/lib/challenge/core/types";
import type { TelemetryEvent } from "@/lib/telemetry/events";

export type NaturalChallengeRenderProps = {
  challenge: PublicChallengeResponse;
  poses: ObjectPose[];
  elapsedMs: number;
  complete: boolean;
  interactive: boolean;
  /** Wall-clock ms when challenge became active (align samples to server). */
  serverStartedAtMs: number;
  onSamples: (samples: InteractionSample[], interactionCount: number) => void;
  accessibleMode: boolean;
};

export function NaturalChallengeShell({
  challengeType,
  difficulty = 1,
  title,
  renderScene,
}: {
  challengeType: ChallengeType;
  difficulty?: 1 | 2;
  title: string;
  renderScene: (props: NaturalChallengeRenderProps) => React.ReactNode;
}) {
  const [loadState, setLoadState] = useState<"loading" | "issued" | "active" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<PublicChallengeResponse | null>(null);
  const [poses, setPoses] = useState<ObjectPose[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [complete, setComplete] = useState(false);
  const [samples, setSamples] = useState<InteractionSample[]>([]);
  const [accessibleMode, setAccessibleMode] = useState(false);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [interactionCount, setInteractionCount] = useState(0);
  const [verifyStatus, setVerifyStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<VerificationPayload | null>(null);

  const durationMs = challenge?.scene.durationMs ?? 0;
  const minActiveMs = Math.floor(durationMs * 0.85);
  const canVerify =
    startedAt !== null &&
    samples.length >= 2 &&
    elapsedMs >= minActiveMs;

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
    setResult(null);
    setVerifyStatus("idle");
    setEvents([]);
    setStartedAt(null);
    setInteractionCount(0);
    setPoses([]);
    setElapsedMs(0);
    setComplete(false);
    setSamples([]);

    try {
      const response = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ difficulty, challengeType }),
      });
      const data = (await response.json()) as PublicChallengeResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create challenge");
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
  }, [challengeType, difficulty]);

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
      const now = Date.now();
      setPoses(data.poses);
      setElapsedMs(data.elapsedMs);
      setComplete(data.complete);
      setStartedAt(now);
      setLoadState("active");
      pushEvent("challenge_started");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start failed");
    }
  };

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
    const id = window.setInterval(() => void poll(), 100);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [loadState, challenge, complete]);

  const onSamples = (next: InteractionSample[], count: number) => {
    setSamples(next);
    setInteractionCount(count);
  };

  const onVerify = async () => {
    if (!challenge) return;
    if (samples.length < 2) {
      setError("Interact with the challenge before verifying.");
      return;
    }
    if (!canVerify) {
      setError(
        `Wait for the active window (~${(minActiveMs / 1000).toFixed(1)}s) before verifying.`,
      );
      return;
    }
    setVerifyStatus("loading");
    setError(null);
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
          interaction: { samples },
          telemetry: {
            completionTimeMs,
            interactionEventCount: interactionCount,
            retryCount: 0,
            startedAt: startedAt ? new Date(startedAt).toISOString() : undefined,
            events: events.slice(0, 40),
          },
        }),
      });
      const data = (await response.json()) as VerificationPayload & {
        error?: string;
      };
      if (!response.ok) {
        const err =
          data.error === "premature_submit"
            ? "Too early — keep interacting until the timer completes."
            : (data.error ?? `HTTP ${response.status}`);
        setVerifyStatus("error");
        setResult({
          verified: false,
          decision: "restrict",
          riskScore: 1,
          confidence: 0.5,
          band: "HIGH",
          challengeId: challenge.challengeId,
          error: err,
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

  const progress = durationMs ? Math.min(1, elapsedMs / durationMs) : 0;

  return (
    <div className="space-y-6" data-testid={`${challengeType}-widget`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">
            AgentProof v0.2
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-50">{title}</h2>
          <p
            className="mt-2 max-w-xl text-slate-300"
            data-testid="challenge-instruction"
          >
            {challenge?.instruction ?? "Loading challenge…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAccessibleMode((v) => !v)}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
            data-testid="toggle-accessible"
          >
            {accessibleMode ? "Pointer mode" : "Accessible mode"}
          </button>
          <Link
            href="/demo"
            className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
          >
            All challenges
          </Link>
          <button
            type="button"
            onClick={() => void loadChallenge()}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
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
            <div className="flex flex-col items-start gap-4 rounded-md border border-slate-800 bg-slate-950/50 p-6">
              <p className="text-slate-300">
                Challenge issued. Obstacle / gate motion is revealed only after
                you start — future trajectories stay on the server.
              </p>
              {challenge.accessibilityHint ? (
                <p className="text-xs text-slate-500">{challenge.accessibilityHint}</p>
              ) : null}
              <button
                type="button"
                data-testid="start-challenge"
                onClick={() => void startChallenge()}
                className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Start challenge
              </button>
            </div>
          ) : null}

          {loadState === "active" && startedAt ? (
            <>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                <span data-testid="elapsed-label">
                  {(elapsedMs / 1000).toFixed(1)}s / {(durationMs / 1000).toFixed(1)}s
                </span>
                <span>
                  {complete
                    ? "Window complete — you can verify"
                    : canVerify
                      ? "Ready to verify"
                      : "Active…"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-cyan-400 transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              {renderScene({
                challenge,
                poses,
                elapsedMs,
                complete,
                interactive: true,
                serverStartedAtMs: startedAt,
                onSamples,
                accessibleMode,
              })}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-testid="verify-button"
                  disabled={!canVerify || verifyStatus === "loading"}
                  onClick={() => void onVerify()}
                  className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Verify
                </button>
                <span className="text-sm text-slate-400">
                  {samples.length} interaction samples
                  {!canVerify && samples.length >= 2
                    ? ` · wait ~${Math.max(0, (minActiveMs - elapsedMs) / 1000).toFixed(1)}s`
                    : ""}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                This is a pilot accessibility implementation and is not
                WCAG-certified. Accessible mode uses discrete moves with live
                position announcements — same server validation as pointer drag.
              </p>
            </>
          ) : null}
        </>
      ) : null}

      <VerificationResult status={verifyStatus} result={result} />
    </div>
  );
}
