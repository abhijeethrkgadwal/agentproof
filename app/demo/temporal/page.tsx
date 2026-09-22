import Link from "next/link";
import { Challenge } from "@/components/agentproof/Challenge";

export default function TemporalDemoPage() {
  return (
    <main className="min-h-screen ap-glow">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-50" />
      <div className="relative mx-auto w-full max-w-4xl px-6 py-8">
        <header className="mb-10 flex items-center justify-between">
          <Link
            href="/demo"
            className="font-display text-xl text-slate-50 hover:text-cyan-300"
          >
            AgentProof
          </Link>
          <span className="font-mono text-xs text-slate-500">
            Temporal · original research challenge
          </span>
        </header>
        <Challenge difficulty={1} />
      </div>
    </main>
  );
}
