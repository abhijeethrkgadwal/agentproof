"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BenchmarkRow, LabRunRecord } from "@/lib/lab/types";

function fmtMs(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `${Math.round(v)} ms`;
}

function fmtRate(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

export default function LabPage() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkRow[]>([]);
  const [runs, setRuns] = useState<LabRunRecord[]>([]);
  const [formula, setFormula] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [l3, setL3] = useState<{ id: string; status: string } | null>(null);

  const refresh = useCallback(async () => {
    const [b, r, stub] = await Promise.all([
      fetch("/api/lab/benchmark").then((res) => res.json()),
      fetch("/api/lab/runs").then((res) => res.json()),
      fetch("/api/lab/l3").then((res) => res.json()),
    ]);
    setBenchmarks(b.benchmarks ?? []);
    setFormula(b.formula ?? "");
    setRuns(r.runs ?? []);
    setL3(stub.agent ?? null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dashboard bootstrap fetch
    void refresh();
  }, [refresh]);

  const runL1 = async (count: number) => {
    setBusy(true);
    setMessage(`Running L1 API observer × ${count}…`);
    try {
      const res = await fetch("/api/lab/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "l1", count, difficulty: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "l1_failed");
      const ok = (data.runs as LabRunRecord[]).filter((x) => x.success).length;
      setMessage(`L1 finished: ${ok}/${data.runs.length} succeeded`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  };

  const recordHuman = async (success: boolean) => {
    setBusy(true);
    try {
      await fetch("/api/lab/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "human",
          difficulty: 1,
          success,
          timeToSolveMs: success ? 6200 : 8000,
          framesObserved: 40,
          actions: 3,
          apiCalls: 0,
          notes: "Dashboard-entered human baseline (honest synthetic placeholder until larger N)",
        }),
      });
      setMessage(success ? "Recorded human success sample" : "Recorded human failure sample");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const levelLabel: Record<string, string> = {
    human: "Human baseline",
    l1_api_observer: "L1 API observer",
    l2_browser: "L2 Browser automation",
    l3_vision: "L3 Vision agent (stub)",
  };

  return (
    <main className="min-h-screen ap-glow">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-40" />
      <div className="relative mx-auto max-w-6xl px-6 py-8 space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.25em] text-cyan-400/80">
              AGENT LAB · PHASE 4
            </p>
            <h1 className="font-display mt-1 text-3xl text-slate-50">
              Automation cost benchmark
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Measure human vs API observer vs browser automation against the
              Phase 3 protocol. No protocol hardening. No Jev/ML.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/" className="text-slate-400 hover:text-white">
              Home
            </Link>
            <Link href="/demo" className="text-slate-400 hover:text-white">
              Demo
            </Link>
          </div>
        </header>

        <section className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runL1(5)}
            className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
          >
            Run L1 × 5
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runL1(1)}
            className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 disabled:opacity-40"
          >
            Run L1 × 1
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void recordHuman(true)}
            className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 disabled:opacity-40"
          >
            Record human success
          </button>
          <p className="w-full text-xs text-slate-500">
            L2: <code className="text-slate-300">npm run lab:l2</code> · L3 stub:{" "}
            {l3 ? `${l3.id} (${l3.status})` : "—"}
          </p>
          {message ? (
            <p className="w-full text-sm text-cyan-200/90" data-testid="lab-message">
              {message}
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="font-display text-xl text-slate-50">Benchmarks</h2>
          <p className="mt-1 font-mono text-xs text-slate-500">{formula}</p>
          <div className="mt-4 overflow-x-auto rounded border border-slate-800">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">Runs</th>
                  <th className="px-3 py-2">Success</th>
                  <th className="px-3 py-2">Median time</th>
                  <th className="px-3 py-2">P95 time</th>
                  <th className="px-3 py-2">Median frames</th>
                  <th className="px-3 py-2">Median API</th>
                  <th className="px-3 py-2">Automation Cost</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((row) => (
                  <tr key={row.level} className="border-t border-slate-800/80">
                    <td className="px-3 py-2 text-slate-100">
                      {levelLabel[row.level] ?? row.level}
                    </td>
                    <td className="px-3 py-2">{row.runs}</td>
                    <td className="px-3 py-2">{fmtRate(row.successRate)}</td>
                    <td className="px-3 py-2">{fmtMs(row.medianSolveMs)}</td>
                    <td className="px-3 py-2">{fmtMs(row.p95SolveMs)}</td>
                    <td className="px-3 py-2">
                      {row.medianFrames === null
                        ? "—"
                        : Math.round(row.medianFrames)}
                    </td>
                    <td className="px-3 py-2">
                      {row.medianApiCalls === null
                        ? "—"
                        : Math.round(row.medianApiCalls)}
                    </td>
                    <td className="px-3 py-2 font-mono text-cyan-300">
                      {row.medianAutomationCost === null
                        ? "—"
                        : row.medianAutomationCost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-slate-50">Recent runs</h2>
          <ul className="mt-3 space-y-2 font-mono text-xs text-slate-400">
            {runs.slice(0, 25).map((run) => (
              <li
                key={run.runId}
                className="rounded border border-slate-800/80 bg-slate-950/40 px-3 py-2"
              >
                <span className={run.success ? "text-emerald-400" : "text-rose-400"}>
                  {run.success ? "OK" : "FAIL"}
                </span>{" "}
                {run.level} · {run.timeToSolveMs}ms · frames {run.framesObserved} ·
                api {run.apiCalls} · cost {run.automationCost}
                {run.notes ? ` · ${run.notes.slice(0, 80)}` : ""}
              </li>
            ))}
            {runs.length === 0 ? (
              <li>No runs yet — execute L1 or record a human baseline.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </main>
  );
}
