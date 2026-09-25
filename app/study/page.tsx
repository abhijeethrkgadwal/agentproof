"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SiteFooter } from "@/components/brand/SiteChrome";
import type {
  FrameResponse,
  ObjectPose,
  PublicChallengeResponse,
} from "@/lib/challenge/types";
import {
  VerificationResult,
  type VerificationPayload,
} from "@/components/agentproof/VerificationResult";
import type { StudyAggregate } from "@/lib/study/types";

function StudyAggregatePanel() {
  const [aggregate, setAggregate] = useState<StudyAggregate | null>(null);
  useEffect(() => {
    void fetch("/api/study/aggregate")
      .then((r) => r.json())
      .then((d) => setAggregate(d.aggregate ?? null))
      .catch(() => setAggregate(null));
  }, []);
  if (!aggregate) {
    return (
      <p className="text-xs text-slate-500" data-testid="study-aggregate-loading">
        Loading aggregate stats…
      </p>
    );
  }
  return (
    <div
      className="rounded border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300"
      data-testid="study-aggregate-panel"
    >
      <p className="text-xs text-amber-200/90">{aggregate.label}</p>
      <ul className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
        <li>participants: {aggregate.participantCount}</li>
        <li>attempts: {aggregate.attempts}</li>
        <li>success: {(aggregate.successRate * 100).toFixed(0)}%</li>
        <li>abandon: {(aggregate.abandonmentRate * 100).toFixed(0)}%</li>
        <li>
          median time:{" "}
          {aggregate.medianCompletionTimeMs === null
            ? "-"
            : `${Math.round(aggregate.medianCompletionTimeMs)} ms`}
        </li>
        <li>
          p95 time:{" "}
          {aggregate.p95CompletionTimeMs === null
            ? "-"
            : `${Math.round(aggregate.p95CompletionTimeMs)} ms`}
        </li>
      </ul>
    </div>
  );
}

type Phase =
  | "consent"
  | "id"
  | "ready"
  | "running"
  | "between"
  | "done";

const CONSENT_TEXT = `You are joining an observational pilot of AgentProof's temporal research challenge (difficulty 1, then difficulty 2).

We collect only an anonymous participant ID you choose, plus challenge outcome metrics (success/failure, timing, retries, interaction counts, frames observed, whether you used the accessibility path).

We do NOT collect your name, email, location, fingerprints, keystrokes, clipboard, or facial data.

Results are used in aggregate only. Individual participant results are not shown publicly.

This is an observational pilot - not a scientific human-performance study.`;

export default function StudyPage() {
  const [phase, setPhase] = useState<Phase>("consent");
  const [consented, setConsented] = useState(false);
  const [participantId, setParticipantId] = useState("");
  const [difficulty, setDifficulty] = useState<1 | 2>(1);
  const [completedDiffs, setCompletedDiffs] = useState<number[]>([]);
  const [challenge, setChallenge] = useState<PublicChallengeResponse | null>(
    null,
  );
  const [poses, setPoses] = useState<ObjectPose[]>([]);
  const [complete, setComplete] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [framesObserved, setFramesObserved] = useState(0);
  const [events, setEvents] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<VerificationPayload | null>(null);
  const [useA11y, setUseA11y] = useState(false);

  const idValid = useMemo(
    () => /^[a-zA-Z0-9_-]{2,64}$/.test(participantId.trim()),
    [participantId],
  );

  const issue = useCallback(async (diff: 1 | 2) => {
    setMessage(null);
    setResult(null);
    setVerifyStatus("idle");
    setSelected(null);
    setComplete(false);
    setFramesObserved(0);
    setEvents(0);
    setRetryCount(0);
    const res = await fetch("/api/challenge", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty: diff }),
    });
    const data = (await res.json()) as PublicChallengeResponse;
    setChallenge(data);
    setDifficulty(diff);
    setPhase("ready");
  }, []);

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
    setFramesObserved(1);
    setStartedAt(Date.now());
    setEvents(1);
    setPhase("running");
  };

  useEffect(() => {
    if (phase !== "running" || !challenge || complete) return;
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
      setFramesObserved((n) => n + 1);
      if (data.complete) setComplete(true);
    }, 200);
    return () => window.clearInterval(id);
  }, [phase, challenge, complete]);

  const recordAttempt = async (payload: {
    success: boolean;
    completionTimeMs: number;
    abandoned?: boolean;
  }) => {
    await fetch("/api/study/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: participantId.trim(),
        challengeId: challenge?.challengeId ?? "abandoned",
        difficulty,
        success: payload.success,
        completionTimeMs: payload.completionTimeMs,
        retryCount,
        interactionEventCount: events,
        framesObserved,
        accessibilityPathUsed: useA11y,
        abandoned: payload.abandoned ?? false,
      }),
    });
  };

  const verify = async () => {
    if (!challenge || !selected || !startedAt) return;
    setVerifyStatus("loading");
    setEvents((n) => n + 1);
    const completionTimeMs = Date.now() - startedAt;
    const res = await fetch("/api/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: selected,
        telemetry: {
          completionTimeMs,
          interactionEventCount: events + 1,
          retryCount,
          events: [],
        },
      }),
    });
    const data = (await res.json()) as VerificationPayload & { error?: string };
    const success = res.ok && data.verified === true;
    setResult(data);
    setVerifyStatus(success ? "success" : "error");
    if (!success) setRetryCount((n) => n + 1);
    await recordAttempt({ success, completionTimeMs });
    setCompletedDiffs((prev) =>
      prev.includes(difficulty) ? prev : [...prev, difficulty],
    );
    setPhase("between");
  };

  const abandon = async () => {
    await recordAttempt({
      success: false,
      completionTimeMs: startedAt ? Date.now() - startedAt : 0,
      abandoned: true,
    });
    setPhase("done");
    setMessage("Session ended. Thank you.");
  };

  return (
    <main className="min-h-screen ap-glow">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-40" />
      <div className="relative mx-auto max-w-3xl px-6 py-10 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <BrandLogo size="sm" />
            <p className="font-mono text-xs tracking-[0.25em] text-cyan-400/80">
              OBSERVATIONAL PILOT
            </p>
            <h1 className="font-display text-3xl text-slate-50">
              Observational pilot
            </h1>
            <p className="text-sm text-slate-400">
              Temporal research challenge only - not a scientific
              human-performance study. Natural demos live under{" "}
              <Link href="/demo" className="text-cyan-400 hover:underline">
                /demo
              </Link>
              .
            </p>
            <p className="text-xs text-amber-200/80">
              Research Prototype - not production security
              infrastructure. Target N 30-50; results report honest N only.
            </p>
          </div>
          <nav className="flex gap-3 text-sm">
            <Link href="/" className="text-slate-400 hover:text-white">
              Home
            </Link>
            <Link href="/lab" className="text-slate-400 hover:text-white">
              Lab
            </Link>
            <Link
              href="/demo/accessible"
              className="text-slate-400 hover:text-white"
            >
              Accessible demo
            </Link>
          </nav>
        </header>

        {phase === "consent" ? (
          <section
            className="space-y-4 rounded-md border border-slate-800 bg-slate-950/60 p-6"
            data-testid="study-consent"
          >
            <h2 className="text-lg text-slate-100">Consent</h2>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-300">
              {CONSENT_TEXT}
            </pre>
            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                data-testid="study-consent-check"
                className="mt-1"
              />
              I understand and agree to participate anonymously.
            </label>
            <button
              type="button"
              disabled={!consented}
              data-testid="study-consent-continue"
              onClick={() => setPhase("id")}
              className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
            >
              Continue
            </button>
          </section>
        ) : null}

        {phase === "id" ? (
          <section className="space-y-4 rounded-md border border-slate-800 bg-slate-950/60 p-6">
            <h2 className="text-lg text-slate-100">Anonymous participant ID</h2>
            <p className="text-sm text-slate-400">
              Choose a nickname (letters, numbers, _ or -). No email or real
              name.
            </p>
            <input
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              data-testid="study-participant-id"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder="e.g. pilot_42"
              maxLength={64}
            />
            <button
              type="button"
              disabled={!idValid}
              data-testid="study-start-pilot"
              onClick={() => void issue(1)}
              className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
            >
              Start difficulty 1
            </button>
          </section>
        ) : null}

        {phase === "ready" && challenge ? (
          <section className="space-y-4 rounded-md border border-slate-800 bg-slate-950/60 p-6">
            <p className="text-slate-300">{challenge.instruction}</p>
            <p className="font-mono text-xs text-slate-500">
              difficulty {difficulty} · {challenge.scene.objects.length} objects
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={useA11y}
                onChange={(e) => setUseA11y(e.target.checked)}
              />
              Prefer list / accessible presentation
            </label>
            <button
              type="button"
              data-testid="study-start-challenge"
              onClick={() => void start()}
              className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Start challenge
            </button>
          </section>
        ) : null}

        {phase === "running" && challenge ? (
          <section className="space-y-4">
            <p className="text-slate-300">{challenge.instruction}</p>
            {useA11y ? (
              <ul className="space-y-2" aria-live="polite">
                {poses.map((pose) => (
                  <li key={pose.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(pose.id);
                        setEvents((n) => n + 1);
                      }}
                      aria-pressed={selected === pose.id}
                      className={`w-full rounded border px-3 py-2 text-left text-sm ${
                        selected === pose.id
                          ? "border-cyan-400 bg-cyan-950/40"
                          : "border-slate-700"
                      }`}
                    >
                      {pose.id} · {pose.shape} · {pose.color} · (
                      {Math.round(pose.x)},{Math.round(pose.y)})
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {poses.map((pose) => (
                  <button
                    key={pose.id}
                    type="button"
                    onClick={() => {
                      setSelected(pose.id);
                      setEvents((n) => n + 1);
                    }}
                    className={`rounded border p-3 text-left text-sm ${
                      selected === pose.id
                        ? "border-cyan-400"
                        : "border-slate-700"
                    }`}
                    style={{ borderLeftColor: pose.color, borderLeftWidth: 4 }}
                  >
                    {pose.id}
                    <div className="text-xs text-slate-500">
                      {Math.round(pose.x)},{Math.round(pose.y)}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                data-testid="study-verify"
                disabled={!selected || !complete || verifyStatus === "loading"}
                onClick={() => void verify()}
                className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
              >
                Verify
              </button>
              <button
                type="button"
                onClick={() => void abandon()}
                className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300"
              >
                Abandon session
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {complete ? "Observation complete" : "Watching…"} · frames{" "}
              {framesObserved}
            </p>
            <VerificationResult status={verifyStatus} result={result} />
          </section>
        ) : null}

        {phase === "between" ? (
          <section className="space-y-4 rounded-md border border-slate-800 bg-slate-950/60 p-6">
            <VerificationResult status={verifyStatus} result={result} />
            <p className="text-sm text-slate-400">
              Completed difficulties: {completedDiffs.join(", ") || "none"}
            </p>
            {!completedDiffs.includes(2) ? (
              <button
                type="button"
                data-testid="study-next-diff2"
                onClick={() => void issue(2)}
                className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
              >
                Continue to difficulty 2
              </button>
            ) : (
              <button
                type="button"
                data-testid="study-finish"
                onClick={() => {
                  setPhase("done");
                  setMessage("Thank you. Only aggregate stats are published.");
                }}
                className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
              >
                Finish
              </button>
            )}
          </section>
        ) : null}

        {phase === "done" ? (
          <section
            className="space-y-4 rounded-md border border-slate-800 bg-slate-950/60 p-6"
            data-testid="study-done"
          >
            <p className="text-slate-200">
              {message ?? "Thank you for participating."}
            </p>
            <p className="text-sm text-slate-500">
              Individual results are not shown publicly. Aggregates below (and on
              the Agent Lab dashboard) are labeled as an observational pilot -
              not a scientific human-performance study.
            </p>
            <StudyAggregatePanel />
            <Link
              href="/lab"
              className="mt-2 inline-block text-cyan-400 hover:underline"
            >
              View Lab aggregates
            </Link>
          </section>
        ) : null}
      </div>
      <SiteFooter />
    </main>
  );
}
