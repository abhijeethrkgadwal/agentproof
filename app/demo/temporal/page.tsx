import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Challenge } from "@/components/agentproof/Challenge";
import { SITE } from "@/lib/site";

export default function TemporalDemoPage() {
  return (
    <main className="relative min-h-screen ap-glow">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-50" />
      <div className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
          <BrandLogo size="sm" href="/demo" />
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 sm:text-sm">
            <Link href="/demo/accessible" className="hover:text-cyan-300">
              Prefer keyboard / list?
            </Link>
            <span className="font-mono">Temporal · research</span>
          </div>
        </header>
        <div className="mb-6 max-w-2xl space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">
            Original research challenge
          </p>
          <p className="text-sm text-slate-400">
            Watch the objects move, then select the one that matches the
            instruction. Ground truth stays on the server. Prefer a list
            instead of the canvas? Use the{" "}
            <Link href="/demo/accessible" className="text-cyan-400 hover:underline">
              accessible path
            </Link>
            .
          </p>
        </div>
        <Challenge difficulty={1} />
        <p className="mt-8 text-xs text-slate-600">
          Research prototype ·{" "}
          <a
            href={SITE.githubUrl}
            className="hover:text-slate-400"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </p>
      </div>
    </main>
  );
}
