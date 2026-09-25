import Link from "next/link";
import { SITE } from "@/lib/site";

const CHALLENGES = [
  {
    href: "/demo/drag-avoid",
    title: "Dynamic Drag & Avoid",
    badge: "Natural interaction",
    body: "Drag the blue object to the green target. Avoid moving obstacles along the way.",
  },
  {
    href: "/demo/physical",
    title: "Physical Interaction",
    badge: "Natural interaction",
    body: "Place the red block on the platform without knocking the blue block off.",
  },
  {
    href: "/demo/dynamic-path",
    title: "Dynamic Path",
    badge: "Natural interaction",
    body: "Guide the ball through moving gate openings to the goal line.",
  },
  {
    href: "/demo/temporal",
    title: "Temporal (Research)",
    badge: "Original research challenge",
    body: "Watch the scene, then pick the object that changed direction the required number of times. Security baseline from the early research phases.",
  },
] as const;

export default function DemoHubPage() {
  return (
    <main className="relative min-h-screen ap-glow">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-50" />
      <div className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
          <Link
            href="/"
            className="font-display text-xl text-slate-50 hover:text-cyan-300"
          >
            AgentProof
          </Link>
          <div className="flex items-center gap-3 text-xs text-slate-500 sm:text-sm">
            <a
              href={SITE.githubUrl}
              className="hover:text-cyan-300"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            <span className="font-mono">Demo hub</span>
          </div>
        </header>

        <div className="ap-fade-up mb-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">
            Try a challenge
          </p>
          <h1 className="font-display text-3xl text-slate-50 sm:text-4xl">
            Choose how you want to interact
          </h1>
          <p className="max-w-2xl text-slate-300">
            Natural challenges feel like short games. Temporal is the original
            research challenge. Every path keeps the answer on the server and
            returns an interaction risk signal - not a “you are human”
            certificate.
          </p>
          <p className="text-sm text-amber-200/80">
            Research prototype - for learning and experimentation, not production
            bot defense.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CHALLENGES.map((c, i) => (
            <Link
              key={c.href}
              href={c.href}
              className={`ap-fade-up group rounded-lg border border-slate-800 bg-slate-950/40 p-5 transition hover:border-cyan-500/40 hover:bg-slate-900/60 ${
                i === 1 ? "ap-fade-up-delay" : i >= 2 ? "ap-fade-up-delay-2" : ""
              }`}
              data-testid={`demo-link-${c.href.split("/").pop()}`}
            >
              <p className="font-mono text-[11px] uppercase tracking-wider text-cyan-400/80">
                {c.badge}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-50 group-hover:text-cyan-200">
                {c.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {c.body}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-8 space-y-3 rounded-lg border border-slate-800/80 bg-slate-950/30 p-5">
          <h2 className="text-base font-semibold text-slate-200">
            Prefer keyboard or a list instead of a canvas?
          </h2>
          <p className="text-sm text-slate-400">
            Use the accessible temporal path: same server protocol, step-by-step
            list selection, and live status updates. Pilot only - not
            WCAG-certified.
          </p>
          <Link
            href="/demo/accessible"
            className="inline-flex min-h-10 items-center text-sm font-medium text-cyan-300 hover:text-cyan-200"
          >
            Open accessible mode →
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
          <Link href="/lab" className="hover:text-cyan-300">
            Agent Lab
          </Link>
          <Link href="/challenge-lab" className="hover:text-cyan-300">
            Comparison lab
          </Link>
          <Link href="/study" className="hover:text-cyan-300">
            Observational study
          </Link>
          <a
            href={SITE.githubUrl}
            className="hover:text-cyan-300"
            rel="noreferrer"
            target="_blank"
          >
            Source on GitHub
          </a>
        </div>
      </div>
    </main>
  );
}
