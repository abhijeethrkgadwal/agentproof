"use client";

import { useCallback, useEffect, useState } from "react";
import { TemporalChallenge } from "@/components/agentproof/TemporalChallenge";
import {
  VerificationResult,
  type VerificationPayload,
} from "@/components/agentproof/VerificationResult";
import type { PublicChallengeResponse } from "@/lib/challenge/types";
import type { TelemetryEvent } from "@/lib/telemetry/events";

type LoadState = "loading" | "ready" | "error";

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

    try {
      const response = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty }),
      });
      const data = (await response.json()) as PublicChallengeResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create challenge");
      }
      // Guard: never accept groundTruth from API even if present
      if ("groundTruth" in data) {
        delete (data as Record<string, unknown>).groundTruth;
      }
      setChallenge(data);
      setLoadState("ready");
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
    // Bootstrap challenge from the API on mount / when difficulty changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount fetch
    void loadChallenge();
  }, [loadChallenge]);

  const onStarted = useCallback(() => {
    setStartedAt((prev) => prev ?? Date.now());
    pushEvent("challenge_started");
  }, [pushEvent]);

  const onSelect = (objectId: string) => {
    setSelectedObjectId(objectId);
    setInteractionCount((count) => count + 1);
    pushEvent("object_selected", { objectId });
  };

  const onVerify = async () => {
    if (!challenge || !selectedObjectId) return;
    setVerifyStatus("loading");
    pushEvent("verification_requested");

    const completionTimeMs = startedAt ? Date.now() - startedAt : 0;
    const payload = {
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
    };

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  return (
    <div className="space-y-6" data-testid="challenge-widget">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">
            AgentProof Verification
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-50">
            Observe the scene.
          </h2>
          <p className="mt-2 max-w-xl text-slate-300" data-testid="challenge-instruction">
            {challenge?.instruction ??
              challenge?.renderConfiguration.instruction ??
              "Loading challenge…"}
          </p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Difficulty
            <select
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
              value={difficulty}
              onChange={() => {
                /* controlled from parent in future; Phase 1 fixed via reload buttons */
              }}
              disabled
              aria-label="Difficulty"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
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

      {loadState === "ready" && challenge ? (
        <>
          <TemporalChallenge
            config={challenge.renderConfiguration}
            selectedObjectId={selectedObjectId}
            onSelect={onSelect}
            onStarted={onStarted}
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
            <span className="text-sm text-slate-400" data-testid="selection-label">
              {selectedObjectId
                ? `Selected: ${selectedObjectId}`
                : "No object selected"}
            </span>
          </div>
        </>
      ) : null}

      <VerificationResult status={verifyStatus} result={result} />
    </div>
  );
}
