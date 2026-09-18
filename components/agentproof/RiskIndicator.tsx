"use client";

import type { RiskBand, RiskDecision } from "@/lib/risk/types";

const bandStyles: Record<RiskBand, string> = {
  LOW: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  MEDIUM: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  HIGH: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};

export function RiskIndicator({
  riskScore,
  band,
  decision,
}: {
  riskScore: number;
  band: RiskBand;
  decision: RiskDecision;
}) {
  const pct = Math.round(riskScore * 100);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-400">Interaction risk score</span>
        <span
          className={`rounded border px-2 py-0.5 text-xs font-medium tracking-wide ${bandStyles[band]}`}
        >
          {band} · {decision}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Interaction risk score"
        />
      </div>
      <p className="font-mono text-2xl text-slate-100">{riskScore.toFixed(2)}</p>
      <p className="text-xs text-slate-500">
        Not a probability of being human — an explainable interaction risk signal.
      </p>
    </div>
  );
}
