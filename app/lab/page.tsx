"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import type { AttackRunRecord, BenchmarkRow, LabRunRecord } from "@/lib/lab/types";
import type { StudyAggregate } from "@/lib/study/types";

function fmtMs(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "-";
  return `${Math.round(v)} ms`;
}

function fmtRate(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

type BenchmarkPayload = {
  formula?: string;
  disclaimer?: string;
  humanObservations?: {
    aggregate?: StudyAggregate;
    syntheticPlaceholderBenchmarks?: BenchmarkRow[];
  };
  automatedAttacks?: {
    benchmarks?: BenchmarkRow[];
    labV2?: Array<{ attackName: string; n: number; successRate: number }>;
  };
  benchmarks?: BenchmarkRow[];
};

const autoLabels: Record<string, string> = {
  l1_api_observer: "L1 API observer",
  l2_browser: "L2 Playwright",
  l3_vision: "L3 Vision agent (stub)",
  lab_v2: "Lab V2 (A-F aggregate)",
};

export default function LabPage() {
  const [data, setData] = useState<BenchmarkPayload>({});
  const [runs, setRuns] = useState<LabRunRecord[]>([]);
  const [v2Runs, setV2Runs] = useState<AttackRunRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [l3, setL3] = useState<{ id: string; status: string } | null>(null);

  const refresh = useCallback(async () => {
    const [b, r, stub, v2] = await Promise.all([
      fetch("/api/lab/benchmark").then((res) => res.json()),
      fetch("/api/lab/runs").then((res) => res.json()),
      fetch("/api/lab/l3").then((res) => res.json()),
      fetch("/api/lab/v2").then((res) => res.json()),
    ]);
    setData(b);
    setRuns(r.runs ?? []);
    setL3(stub.agent ?? null);
    setV2Runs(v2.runs ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dashboard bootstrap
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
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "l1_failed");
      const ok = (body.runs as LabRunRecord[]).filter((x) => x.success).length;
      setMessage(`L1 finished: ${ok}/${body.runs.length} succeeded`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  };

  const runV2 = async (attack: string) => {
    setBusy(true);
    setMessage(`Running Lab V2: ${attack}…`);
    try {
      const res = await fetch("/api/lab/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attack, difficulty: 1 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "v2_failed");
      const ok = (body.runs as AttackRunRecord[]).filter((x) => x.success).length;
      setMessage(`Lab V2 ${attack}: ${ok}/${body.runs.length} attacker-success`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  };

  const human = data.humanObservations?.aggregate;
  const auto = data.automatedAttacks?.benchmarks ?? [];
  const v2Summary = data.automatedAttacks?.labV2 ?? [];

  return (
    <main className="min-h-screen ap-glow">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-40" />
      <div className="relative mx-auto max-w-6xl px-6 py-8 space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <BrandLogo size="sm" />
            <p className="font-mono text-xs tracking-[0.25em] text-cyan-400/80">
              AGENT LAB · v0.2
            </p>
            <h1 className="font-display text-3xl text-slate-50">
              Human baseline & automation cost
            </h1>
            <p className="max-w-2xl text-sm text-slate-400">
              Challenge types: temporal, drag_avoid, physical, dynamic_path.
              Historical temporal Lab V2 A-F unchanged. Natural-challenge
              attackers are placeholders only - no fake benchmarks. Automation
              Cost is experimental - not a universal security score.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/" className="text-slate-400 hover:text-white">
              Home
            </Link>
            <Link href="/study" className="text-slate-400 hover:text-white">
              Study
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
            onClick={() => void runV2("all")}
            className="rounded border border-cyan-700/60 px-4 py-2 text-sm text-cyan-100 disabled:opacity-40"
          >
            Run Lab V2 A-F
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runV2("frame_reconstruction_v2")}
            className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 disabled:opacity-40"
          >
            V2: Frame reconstr.
          </button>
          <p className="w-full text-xs text-slate-500">
            L2 CLI: <code className="text-slate-300">npm run lab:l2</code> · Gates:{" "}
            <code className="text-slate-300">npm run lab:gates</code> · L3:{" "}
            {l3 ? `${l3.id} (${l3.status})` : "-"}
          </p>
          {message ? (
            <p className="w-full text-sm text-cyan-200/90" data-testid="lab-message">
              {message}
            </p>
          ) : null}
        </section>

        <section data-testid="human-observations">
          <h2 className="font-display text-xl text-slate-50">
            HUMAN OBSERVATIONS
          </h2>
          <p className="mt-1 text-xs text-amber-200/80">
            {human?.label ??
              "Observational pilot - not a scientific human-performance study."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Source: <Link href="/study" className="text-cyan-400">/study</Link>{" "}
            only. Synthetic dashboard placeholders are not mixed into these
            aggregates.
          </p>
          <div className="mt-4 overflow-x-auto rounded border border-slate-800">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Participants</th>
                  <th className="px-3 py-2">Attempts</th>
                  <th className="px-3 py-2">Success</th>
                  <th className="px-3 py-2">Median time</th>
                  <th className="px-3 py-2">P95 time</th>
                  <th className="px-3 py-2">Abandon</th>
                  <th className="px-3 py-2">Median retries</th>
                  <th className="px-3 py-2">Median events</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-800/80">
                  <td className="px-3 py-2">{human?.participantCount ?? 0}</td>
                  <td className="px-3 py-2">{human?.attempts ?? 0}</td>
                  <td className="px-3 py-2">
                    {fmtRate(human?.successRate ?? 0)}
                  </td>
                  <td className="px-3 py-2">
                    {fmtMs(human?.medianCompletionTimeMs ?? null)}
                  </td>
                  <td className="px-3 py-2">
                    {fmtMs(human?.p95CompletionTimeMs ?? null)}
                  </td>
                  <td className="px-3 py-2">
                    {fmtRate(human?.abandonmentRate ?? 0)}
                  </td>
                  <td className="px-3 py-2">
                    {human?.medianRetries ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    {human?.medianInteractionEvents ?? "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section data-testid="automated-attacks">
          <h2 className="font-display text-xl text-slate-50">
            AUTOMATED ATTACKS
          </h2>
          <p className="mt-1 font-mono text-xs text-slate-500">
            {data.formula}
          </p>
          <p className="text-xs text-slate-500">{data.disclaimer}</p>
          <div className="mt-4 overflow-x-auto rounded border border-slate-800">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">n</th>
                  <th className="px-3 py-2">Success</th>
                  <th className="px-3 py-2">Median time</th>
                  <th className="px-3 py-2">P95 time</th>
                  <th className="px-3 py-2">Median frames</th>
                  <th className="px-3 py-2">Median API</th>
                  <th className="px-3 py-2">Automation Cost</th>
                </tr>
              </thead>
              <tbody>
                {auto.map((row) => (
                  <tr key={row.level} className="border-t border-slate-800/80">
                    <td className="px-3 py-2 text-slate-100">
                      {autoLabels[row.level] ?? row.level}
                    </td>
                    <td className="px-3 py-2">{row.runs}</td>
                    <td className="px-3 py-2">{fmtRate(row.successRate)}</td>
                    <td className="px-3 py-2">{fmtMs(row.medianSolveMs)}</td>
                    <td className="px-3 py-2">{fmtMs(row.p95SolveMs)}</td>
                    <td className="px-3 py-2">
                      {row.medianFrames === null
                        ? "-"
                        : Math.round(row.medianFrames)}
                    </td>
                    <td className="px-3 py-2">
                      {row.medianApiCalls === null
                        ? "-"
                        : Math.round(row.medianApiCalls)}
                    </td>
                    <td className="px-3 py-2 font-mono text-cyan-300">
                      {row.medianAutomationCost === null
                        ? "-"
                        : row.medianAutomationCost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-6 text-sm font-semibold text-slate-200">
            Lab V2 attack summary (A-F)
          </h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 font-mono text-xs text-slate-400">
            {v2Summary.map((row) => (
              <li
                key={row.attackName}
                className="rounded border border-slate-800/80 px-3 py-2"
              >
                {row.attackName}: n={row.n} · success{" "}
                {(row.successRate * 100).toFixed(0)}%
              </li>
            ))}
            {v2Summary.length === 0 ? (
              <li>No Lab V2 runs yet.</li>
            ) : null}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-slate-50">Recent activity</h2>
          <ul className="mt-3 space-y-2 font-mono text-xs text-slate-400">
            {v2Runs.slice(0, 12).map((run) => (
              <li
                key={run.runId}
                className="rounded border border-slate-800/80 bg-slate-950/40 px-3 py-2"
              >
                <span
                  className={run.success ? "text-rose-400" : "text-emerald-400"}
                >
                  {run.success ? "ATTACK_OK" : "BLOCKED/FAIL"}
                </span>{" "}
                {run.attackName} · {run.solveTimeMs}ms · frames {run.frameCount} ·
                api {run.apiRequestCount} · cost {run.automationCost}
              </li>
            ))}
            {runs.slice(0, 12).map((run) => (
              <li
                key={run.runId}
                className="rounded border border-slate-800/80 bg-slate-950/40 px-3 py-2"
              >
                <span
                  className={run.success ? "text-emerald-400" : "text-rose-400"}
                >
                  {run.success ? "OK" : "FAIL"}
                </span>{" "}
                {run.level} · {run.timeToSolveMs}ms · frames {run.framesObserved} ·
                api {run.apiCalls} · cost {run.automationCost}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
