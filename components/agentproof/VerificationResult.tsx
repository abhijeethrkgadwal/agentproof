"use client";

import { RiskIndicator } from "@/components/agentproof/RiskIndicator";
import type { RiskBand, RiskDecision, RiskFactor } from "@/lib/risk/types";

export type VerificationPayload = {
  verified: boolean;
  decision: RiskDecision;
  riskScore: number;
  confidence: number;
  band: RiskBand;
  challengeId: string;
  reason?: string;
  factors?: RiskFactor[];
  error?: string;
};

export function VerificationResult({
  status,
  result,
}: {
  status: "idle" | "loading" | "success" | "error";
  result: VerificationPayload | null;
}) {
  if (status === "idle") {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-sm text-slate-400">Status: Waiting for verification</p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-sm text-slate-300 animate-pulse">Verifying…</p>
      </div>
    );
  }

  if (status === "error" || !result) {
    return (
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-4">
        <p className="text-sm text-rose-300">
          Status: {result?.error ?? "Verification failed"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p
          className={`text-sm font-medium ${result.verified ? "text-emerald-300" : "text-rose-300"}`}
          data-testid="verify-status"
        >
          Status: {result.verified ? "Verified" : "Rejected"}
          {result.reason ? ` (${result.reason})` : ""}
        </p>
        <span className="font-mono text-xs text-slate-500">
          confidence {result.confidence.toFixed(2)}
        </span>
      </div>
      <RiskIndicator
        riskScore={result.riskScore}
        band={result.band}
        decision={result.decision}
      />
      {result.factors && result.factors.length > 0 ? (
        <ul className="space-y-1 border-t border-slate-800 pt-3 text-xs text-slate-400">
          {result.factors.map((factor) => (
            <li key={factor.code}>
              <span className="font-mono text-slate-300">{factor.code}</span>
              {" — "}
              {factor.detail}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
