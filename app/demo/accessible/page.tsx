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
 * Minimal non-visual alternative: same progressive frame API, object list + live
 * region announcements instead of canvas. Not a full WCAG audit — Phase 3 stub+.
 */
export default function AccessibleDemoPage() {
  const [challenge, setChallenge] = useState<PublicChallengeResponse | null>(null);
  const [poses, setPoses] = useState<ObjectPose[]>([]);
  const [complete, setComplete] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [result, setResult] = useState<VerificationPayload | null>(null);
  const [phase, setPhase] = useState<"loading" | "issued" | "active">("loading");
  const [live, setLive] = useState("Challenge loading");

  const load = useCallback(async () => {
    setPhase("loading");
    setResult(null);
    setStatus("idle");
    setSelected(null);
    setComplete(false);
    const res = await fetch("/api/challenge", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty: 1 }),
    });
    const data = (await res.json()) as PublicChallengeResponse;
    setChallenge(data);
    setPhase("issued");
    setLive("Challenge issued. Press Start challenge when ready.");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount fetch
    void load();
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
    setLive(`Started. ${data.poses.length} objects in motion.`);
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
      setLive(
        `Elapsed ${(data.elapsedMs / 1000).toFixed(1)}s. Objects: ${data.poses
          .map((p) => `${p.id} at ${Math.round(p.x)},${Math.round(p.y)}`)
          .join("; ")}`,
      );
      if (data.complete) {
        setComplete(true);
        setLive("Observation complete. Select an object, then verify.");
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [phase, challenge, complete]);

  const verify = async () => {
    if (!challenge || !selected) return;
    setStatus("loading");
    const res = await fetch("/api/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: selected,
        telemetry: {
          completionTimeMs: challenge.scene.durationMs,
          interactionEventCount: 4,
          events: [],
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
    setStatus("success");
  };

  return (
    <main className="min-h-screen ap-glow px-6 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <Link href="/demo" className="text-cyan-300 hover:underline">
            ← Canvas demo
          </Link>
          <span className="font-mono text-xs text-slate-500">Accessible mode</span>
        </header>
        <h1 className="font-display text-3xl text-slate-50">AgentProof</h1>
        <p className="text-slate-300">{challenge?.instruction ?? "Loading…"}</p>
        <div className="sr-only" aria-live="polite">
          {live}
        </div>
        <p className="text-sm text-slate-400" aria-hidden="true">
          {live}
        </p>

        {phase === "issued" ? (
          <button
            type="button"
            className="rounded bg-cyan-500 px-4 py-2 font-semibold text-slate-950"
            onClick={() => void start()}
          >
            Start challenge
          </button>
        ) : null}

        {phase === "active" ? (
          <ul className="space-y-2">
            {poses.map((pose) => (
              <li key={pose.id}>
                <button
                  type="button"
                  className={`w-full rounded border px-3 py-2 text-left ${
                    selected === pose.id
                      ? "border-cyan-400 bg-cyan-950/40"
                      : "border-slate-700"
                  }`}
                  onClick={() => setSelected(pose.id)}
                  aria-pressed={selected === pose.id}
                >
                  {pose.id} ({pose.shape}) — position {Math.round(pose.x)},{" "}
                  {Math.round(pose.y)}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="mt-2 rounded bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40"
                disabled={!selected}
                onClick={() => void verify()}
              >
                Verify
              </button>
            </li>
          </ul>
        ) : null}

        <VerificationResult status={status} result={result} />
        <p className="text-xs text-slate-500">
          This is a minimal accessible path using the same progressive frame
          protocol. A fuller WCAG-complete alternative remains a production P0.
        </p>
      </div>
    </main>
  );
}
