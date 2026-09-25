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
import { SITE } from "@/lib/site";

/**
 * Keyboard / list path for the temporal research challenge.
 * Same server protocol as the canvas demo. Pilot - not WCAG-certified.
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
  const [live, setLive] = useState("Loading a new challenge…");
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
      `Ready at difficulty ${diff}. Press “Start watching” when you are ready.`,
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
    setLive(
      `Watching ${data.poses.length} objects. Positions update as the challenge runs. Wait until watching finishes, then pick one object.`,
    );
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
        `Still watching · ${(data.elapsedMs / 1000).toFixed(1)}s elapsed. ${data.poses
          .map(
            (p) =>
              `${friendlyObjectLabel(p)} is at ${Math.round(p.x)}, ${Math.round(p.y)}`,
          )
          .join(". ")}`,
      );
      if (data.complete) {
        setComplete(true);
        setLive(
          "Watching finished. Choose the object that matches the instruction, then press Verify.",
        );
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
    <main className="relative min-h-screen ap-glow px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-40" />
      <div className="relative mx-auto max-w-2xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/demo"
            className="text-sm text-cyan-300 hover:text-cyan-200"
          >
            ← All challenges
          </Link>
          <span className="font-mono text-xs text-slate-500">
            Accessible · temporal · pilot
          </span>
        </header>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">
            Keyboard-friendly path
          </p>
          <h1 className="font-display text-3xl text-slate-50 sm:text-4xl">
            Watch, then choose
          </h1>
          <p className="text-slate-300">
            This is the same temporal research challenge as the canvas demo, but
            presented as a list you can use with a keyboard or screen reader.
            No dragging required.
          </p>
        </div>

        <ol className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          <li>
            <span className="font-medium text-slate-100">1.</span> Read the
            instruction below.
          </li>
          <li>
            <span className="font-medium text-slate-100">2.</span> Press{" "}
            <strong className="font-medium text-slate-100">Start watching</strong>{" "}
            and wait until the status says watching finished.
          </li>
          <li>
            <span className="font-medium text-slate-100">3.</span> Select the
            object that matches the instruction.
          </li>
          <li>
            <span className="font-medium text-slate-100">4.</span> Press{" "}
            <strong className="font-medium text-slate-100">Verify selection</strong>.
          </li>
        </ol>

        <div
          className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
          aria-labelledby="challenge-instruction"
        >
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Your instruction
          </p>
          <p
            className="mt-2 text-base text-slate-100"
            id="challenge-instruction"
          >
            {challenge?.instruction ?? "Loading instruction…"}
          </p>
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {live}
        </div>
        <p
          className="rounded-md border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-sm text-slate-300"
          id="live-status"
          role="status"
        >
          {live}
        </p>

        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Difficulty"
        >
          <span className="mr-1 self-center text-sm text-slate-500">
            Difficulty
          </span>
          <button
            type="button"
            className={`min-h-10 rounded border px-3 py-2 text-sm ${
              difficulty === 1
                ? "border-cyan-400 text-cyan-100"
                : "border-slate-700 text-slate-300"
            }`}
            onClick={() => void load(1)}
          >
            Easier
          </button>
          <button
            type="button"
            className={`min-h-10 rounded border px-3 py-2 text-sm ${
              difficulty === 2
                ? "border-cyan-400 text-cyan-100"
                : "border-slate-700 text-slate-300"
            }`}
            onClick={() => void load(2)}
          >
            Harder
          </button>
        </div>

        {phase === "issued" ? (
          <button
            type="button"
            className="min-h-11 rounded bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400"
            onClick={() => void start()}
            data-testid="a11y-start"
          >
            Start watching
          </button>
        ) : null}

        {phase === "active" ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Updates received: {frames}
              {complete ? " · ready to choose" : " · still watching"}
            </p>
            <ul className="space-y-2" aria-labelledby="challenge-instruction">
              {poses.map((pose) => (
                <li key={pose.id}>
                  <button
                    type="button"
                    className={`min-h-12 w-full rounded-lg border px-3 py-3 text-left transition focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-cyan-400 ${
                      selected === pose.id
                        ? "border-cyan-400 bg-cyan-950/40"
                        : "border-slate-700 hover:border-slate-500"
                    }`}
                    onClick={() => {
                      setSelected(pose.id);
                      setEvents((n) => n + 1);
                    }}
                    aria-pressed={selected === pose.id}
                    data-testid={`a11y-object-${pose.id}`}
                  >
                    <span className="font-medium text-slate-100">
                      {friendlyObjectLabel(pose)}
                    </span>
                    <span className="mt-1 block text-sm text-slate-400">
                      {pose.shape} · {pose.color} · size {pose.size} · position{" "}
                      {Math.round(pose.x)}, {Math.round(pose.y)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="min-h-11 rounded bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
              disabled={!selected || !complete || status === "loading"}
              onClick={() => void verify()}
              data-testid="a11y-verify"
            >
              Verify selection
            </button>
            {!complete ? (
              <p className="text-sm text-slate-500">
                Verify unlocks after watching finishes.
              </p>
            ) : null}
          </div>
        ) : null}

        <VerificationResult status={status} result={result} />

        <aside className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">
          <p>
            Pilot accessibility path for the temporal research challenge. Same
            server checks as the canvas demo.{" "}
            <strong className="font-medium text-slate-300">
              Not a WCAG certification
            </strong>{" "}
            - research prototype only.
          </p>
          <p className="mt-3">
            Prefer the visual canvas?{" "}
            <Link href="/demo/temporal" className="text-cyan-400 hover:underline">
              Open temporal demo
            </Link>
            . Source:{" "}
            <a
              href={SITE.githubUrl}
              className="text-cyan-400 hover:underline"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            .
          </p>
        </aside>
      </div>
    </main>
  );
}

function friendlyObjectLabel(pose: ObjectPose): string {
  const match = /^object_(\d+)$/i.exec(pose.id);
  if (match) return `Object ${match[1]}`;
  return pose.id.replaceAll("_", " ");
}
