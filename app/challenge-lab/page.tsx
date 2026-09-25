"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ALL_CHALLENGE_TYPES,
  CHALLENGE_META,
} from "@/lib/challenge/core/meta";
import type { ChallengeType } from "@/lib/challenge/types";

type SurveyRow = {
  challengeType: ChallengeType;
  clarity: number;
  subjectiveDifficulty: number;
  completionTimeMs: number | null;
  success: boolean | null;
  retries: number;
  abandoned: boolean;
};

const emptyRow = (type: ChallengeType): SurveyRow => ({
  challengeType: type,
  clarity: 3,
  subjectiveDifficulty: 3,
  completionTimeMs: null,
  success: null,
  retries: 0,
  abandoned: false,
});

/**
 * Lightweight internal comparison page for development testing only.
 * Does not claim statistical validity.
 */
export default function ChallengeLabPage() {
  const [rows, setRows] = useState<SurveyRow[]>(() =>
    ALL_CHALLENGE_TYPES.map(emptyRow),
  );

  const summary = useMemo(() => {
    const filled = rows.filter((r) => r.success !== null || r.abandoned);
    return {
      n: filled.length,
      avgClarity:
        filled.length === 0
          ? null
          : filled.reduce((s, r) => s + r.clarity, 0) / filled.length,
    };
  }, [rows]);

  const update = (type: ChallengeType, patch: Partial<SurveyRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.challengeType === type ? { ...r, ...patch } : r)),
    );
  };

  return (
    <main className="min-h-screen ap-glow">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-40" />
      <div className="relative mx-auto w-full max-w-5xl px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/demo" className="font-display text-xl text-slate-50">
            AgentProof
          </Link>
          <span className="font-mono text-xs text-slate-500">
            /challenge-lab · internal only
          </span>
        </header>

        <div className="mb-6 space-y-2">
          <h1 className="font-display text-3xl text-slate-50">
            Human-first comparison lab
          </h1>
          <p className="max-w-2xl text-slate-400">
            Development testing only. Record instruction clarity, completion
            time, success/failure, retries, abandonment, and subjective
            difficulty (1-5). This page does not claim statistical validity.
          </p>
        </div>

        <div className="mb-6 rounded-md border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
          Sessions logged locally in this browser session: {summary.n}
          {summary.avgClarity !== null
            ? ` · avg clarity ${summary.avgClarity.toFixed(1)}`
            : ""}
        </div>

        <div className="space-y-4">
          {rows.map((row) => {
            const meta = CHALLENGE_META[row.challengeType];
            return (
              <section
                key={row.challengeType}
                className="rounded-md border border-slate-800 bg-slate-950/40 p-5"
                data-testid={`lab-row-${row.challengeType}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-50">
                      {meta.label}
                    </h2>
                    <p className="text-sm text-slate-400">{meta.shortDescription}</p>
                    <Link
                      href={
                        row.challengeType === "temporal"
                          ? "/demo/temporal"
                          : row.challengeType === "drag_avoid"
                            ? "/demo/drag-avoid"
                            : row.challengeType === "physical"
                              ? "/demo/physical"
                              : "/demo/dynamic-path"
                      }
                      className="mt-2 inline-block text-sm text-cyan-400 hover:text-cyan-300"
                    >
                      Open demo →
                    </Link>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-sm text-slate-400">
                    Instruction clarity (1-5)
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={row.clarity}
                      onChange={(e) =>
                        update(row.challengeType, {
                          clarity: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full"
                    />
                    <span className="font-mono text-cyan-300">{row.clarity}</span>
                  </label>
                  <label className="text-sm text-slate-400">
                    Subjective difficulty (1-5)
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={row.subjectiveDifficulty}
                      onChange={(e) =>
                        update(row.challengeType, {
                          subjectiveDifficulty: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full"
                    />
                    <span className="font-mono text-cyan-300">
                      {row.subjectiveDifficulty}
                    </span>
                  </label>
                  <label className="text-sm text-slate-400">
                    Completion time (ms)
                    <input
                      type="number"
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                      value={row.completionTimeMs ?? ""}
                      onChange={(e) =>
                        update(row.challengeType, {
                          completionTimeMs: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-400">
                    Retries
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                      value={row.retries}
                      onChange={(e) =>
                        update(row.challengeType, {
                          retries: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button
                      type="button"
                      className={`rounded border px-3 py-1 ${
                        row.success === true
                          ? "border-emerald-400 text-emerald-300"
                          : "border-slate-700 text-slate-300"
                      }`}
                      onClick={() =>
                        update(row.challengeType, {
                          success: true,
                          abandoned: false,
                        })
                      }
                    >
                      Success
                    </button>
                    <button
                      type="button"
                      className={`rounded border px-3 py-1 ${
                        row.success === false
                          ? "border-rose-400 text-rose-300"
                          : "border-slate-700 text-slate-300"
                      }`}
                      onClick={() =>
                        update(row.challengeType, {
                          success: false,
                          abandoned: false,
                        })
                      }
                    >
                      Failure
                    </button>
                    <button
                      type="button"
                      className={`rounded border px-3 py-1 ${
                        row.abandoned
                          ? "border-amber-400 text-amber-300"
                          : "border-slate-700 text-slate-300"
                      }`}
                      onClick={() =>
                        update(row.challengeType, {
                          abandoned: true,
                          success: null,
                        })
                      }
                    >
                      Abandoned
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
