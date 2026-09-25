"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SiteFooter } from "@/components/brand/SiteChrome";
import { NaturalChallengeShell } from "@/components/agentproof/NaturalChallengeShell";
import { DynamicPathChallenge } from "@/components/agentproof/challenges/DynamicPathChallenge";

export default function DynamicPathDemoPage() {
  const [difficulty, setDifficulty] = useState<1 | 2>(1);
  return (
    <main className="relative min-h-screen ap-glow">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-50" />
      <div className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
          <BrandLogo size="sm" href="/demo" />
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Difficulty</span>
            {([1, 2] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`min-h-9 min-w-9 rounded border px-2.5 py-1.5 ${
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
          challengeType="dynamic_path"
          difficulty={difficulty}
          title="Dynamic Path"
          renderScene={(props) => <DynamicPathChallenge {...props} />}
        />
      </div>
      <SiteFooter />
    </main>
  );
}
