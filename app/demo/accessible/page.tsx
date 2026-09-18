"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  VerificationResult,
  type VerificationPayload,
} from "@/components/agentproof/VerificationResult";
import type {
  FrameResponse,
  ObjectPose,
  PublicChallengeResponse,
} from "@/lib/challenge/types";

/**
 * Non-visual verification path for the Phase 6 pilot.
 * Equivalent progressive-frame protocol with list selection + live region.
 * Not a complete WCAG audit.
 */
export default function AccessibleDemoPage() {
  const [challenge, setChallenge] = useState<PublicChallengeResponse | null>(
    null,
  );
  const [poses, setPoses] = useState<ObjectPose[]>([]);
  const [complete, setComplete] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [result, setResult] = useState<VerificationPayload | null>(null);
  const [phase, setPhase] = useState<"loading" | "issued" | "active">("loading");
  const [live, setLive] = useState("Challenge loading");
  const [difficulty, setDifficulty] = useState<1 | 2>(1);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [frames, setFrames] = useState(0);
  const [events, setEvents] = useState(0);

  const load = useCallback(async (diff: 1 | 2) => {
    setPhase("loading");
    setResult(null);
    setStatus("idle");
    setSelected(null);
    setComplete(false);
    setFrames(0);
    setEvents(0);
    setDifficulty(diff);
    const res = await fetch("/api/challenge", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty: diff }),
    });
    const data = (await res.json()) as PublicChallengeResponse;
    setChallenge(data);
    setPhase("issued");
    setLive(
      `Challenge issued at difficulty ${diff}. Press Start challenge when ready.`,
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount fetch
    void load(1);
  }, [load]);

  const start = async () => {
    if (!challenge) return;
    const res = await fetch("/api/challenge/start", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        token: challenge.token,
      }),
    });
    const data = (await res.json()) as FrameResponse;
    setPoses(data.poses);
    setComplete(data.complete);
    setPhase("active");
    setStartedAt(Date.now());
    setFrames(1);
    setEvents(1);
    setLive(`Started. ${data.poses.length} objects updating by position.`);
  };

  useEffect(() => {
    if (phase !== "active" || !challenge || complete) return;
    const id = window.setInterval(async () => {
      const res = await fetch("/api/challenge/frame", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          token: challenge.token,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as FrameResponse;
      setPoses(data.poses);
      setFrames((n) => n + 1);
      setLive(
        `Elapsed ${(data.elapsedMs / 1000).toFixed(1)}s. ${data.poses
          .map((p) => `${p.id} at ${Math.round(p.x)}, ${Math.round(p.y)}`)
          .join(". ")}`,
      );
      if (data.complete) {
        setComplete(true);
        setLive("Observation complete. Select an object with the buttons, then verify.");
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [phase, challenge, complete]);

  const verify = async () => {
    if (!challenge || !selected || !startedAt) return;
    setStatus("loading");
    setEvents((n) => n + 1);
    const res = await fetch("/api/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: selected,
        telemetry: {
          completionTimeMs: Date.now() - startedAt,
          interactionEventCount: events + 1,
          events: [{ type: "accessible_verify" }],
        },
      }),
    });
    const data = (await res.json()) as VerificationPayload & { error?: string };
    if (!res.ok) {
      setStatus("error");
      setResult({
        verified: false,
        decision: "restrict",
        riskScore: 1,
        confidence: 0.4,
        band: "HIGH",
        challengeId: challenge.challengeId,
        error: data.error ?? "verify_failed",
      });
      return;
    }
    setResult(data);
    setStatus(data.verified ? "success" : "error");
  };

  return (
    <main className="min-h-screen ap-glow px-6 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/demo" className="text-cyan-300 hover:underline">
            ← Canvas demo
          </Link>
          <span className="font-mono text-xs text-slate-500">
            Accessible path · pilot
          </span>
        </header>
        <h1 className="font-display text-3xl text-slate-50">AgentProof</h1>
        <p className="text-slate-300" id="instruction">
          {challenge?.instruction ?? "Loading…"}
        </p>
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {live}
        </div>
        <p className="text-sm text-slate-400" id="live-status">
          {live}
        </p>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Difficulty">
          <button
            type="button"
            className={`rounded border px-3 py-1 text-sm ${
              difficulty === 1 ? "border-cyan-400" : "border-slate-700"
            }`}
            onClick={() => void load(1)}
          >
            Difficulty 1
          </button>
          <button
            type="button"
            className={`rounded border px-3 py-1 text-sm ${
              difficulty === 2 ? "border-cyan-400" : "border-slate-700"
            }`}
            onClick={() => void load(2)}
          >
            Difficulty 2
          </button>
        </div>

        {phase === "issued" ? (
          <button
            type="button"
            className="rounded bg-cyan-500 px-4 py-2 font-semibold text-slate-950"
            onClick={() => void start()}
            data-testid="a11y-start"
          >
            Start challenge
          </button>
        ) : null}

        {phase === "active" ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Frames observed: {frames}
              {complete ? " · ready to select" : " · watching"}
            </p>
            <ul className="space-y-2" aria-labelledby="instruction">
              {poses.map((pose) => (
                <li key={pose.id}>
                  <button
                    type="button"
                    className={`w-full rounded border px-3 py-3 text-left focus:outline focus:outline-2 focus:outline-cyan-400 ${
                      selected === pose.id
                        ? "border-cyan-400 bg-cyan-950/40"
                        : "border-slate-700"
                    }`}
                    onClick={() => {
                      setSelected(pose.id);
                      setEvents((n) => n + 1);
                    }}
                    aria-pressed={selected === pose.id}
                    data-testid={`a11y-object-${pose.id}`}
                  >
                    <span className="font-medium text-slate-100">{pose.id}</span>
                    <span className="block text-sm text-slate-400">
                      {pose.shape}, color {pose.color}, size {pose.size}. Position{" "}
                      {Math.round(pose.x)}, {Math.round(pose.y)}.
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="rounded bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40"
              disabled={!selected || !complete || status === "loading"}
              onClick={() => void verify()}
              data-testid="a11y-verify"
            >
              Verify selection
            </button>
          </div>
        ) : null}

        <VerificationResult status={status} result={result} />
        <aside className="rounded border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-500">
          <p>
            This accessible path uses the same server-authoritative progressive
            frame protocol as the canvas demo. It is intended for the Phase 6
            pilot and is <strong className="text-slate-300">not yet a complete WCAG audit</strong>.
          </p>
          <p className="mt-2">
            Prefer the study flow at{" "}
            <Link href="/study" className="text-cyan-400">
              /study
            </Link>{" "}
            when contributing human baseline data.
          </p>
        </aside>
      </div>
    </main>
  );
}
