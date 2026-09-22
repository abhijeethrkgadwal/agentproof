"use client";

import Link from "next/link";
import { useState } from "react";
import { NaturalChallengeShell } from "@/components/agentproof/NaturalChallengeShell";
import { PhysicalInteractionChallenge } from "@/components/agentproof/challenges/PhysicalInteractionChallenge";

export default function PhysicalDemoPage() {
  const [difficulty, setDifficulty] = useState<1 | 2>(1);
  return (
    <main className="min-h-screen ap-glow">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-50" />
      <div className="relative mx-auto w-full max-w-4xl px-6 py-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/demo"
            className="font-display text-xl text-slate-50 hover:text-cyan-300"
          >
            AgentProof
          </Link>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Difficulty</span>
            {[1, 2].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d as 1 | 2)}
                className={`rounded border px-2 py-1 ${
                  difficulty === d
                    ? "border-cyan-400 text-cyan-200"
                    : "border-slate-700"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </header>
        <NaturalChallengeShell
          key={difficulty}
          challengeType="physical"
          difficulty={difficulty}
          title="Physical Interaction"
          renderScene={(props) => <PhysicalInteractionChallenge {...props} />}
        />
      </div>
    </main>
  );
}
