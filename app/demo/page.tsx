import Link from "next/link";

const CHALLENGES = [
  {
    href: "/demo/temporal",
    title: "Temporal (Research)",
    badge: "Original research challenge",
    body: "Observe moving objects and select the one that changed direction the required times. Phase 1–8 security baseline.",
  },
  {
    href: "/demo/drag-avoid",
    title: "Dynamic Drag & Avoid",
    badge: "v0.2 natural",
    body: "Drag the blue object to the green target without hitting moving obstacles.",
  },
  {
    href: "/demo/physical",
    title: "Physical Interaction",
    badge: "v0.2 natural",
    body: "Place the red block on the platform without knocking the blue block off.",
  },
  {
    href: "/demo/dynamic-path",
    title: "Dynamic Path",
    badge: "v0.2 natural",
    body: "Guide the ball through the moving gate opening.",
  },
] as const;

export default function DemoHubPage() {
  return (
    <main className="min-h-screen ap-glow">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-50" />
      <div className="relative mx-auto w-full max-w-4xl px-6 py-10">
        <header className="mb-10 flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-xl text-slate-50 hover:text-cyan-300"
          >
            AgentProof
          </Link>
          <span className="font-mono text-xs text-slate-500">v0.2 demo hub</span>
        </header>

        <div className="ap-fade-up mb-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">
            Challenge lab
          </p>
          <h1 className="font-display text-3xl text-slate-50 sm:text-4xl">
            Choose a challenge
          </h1>
          <p className="max-w-2xl text-slate-300">
            v0.2 adds natural-interaction experiments on top of the v0.1
            research/security foundation. Temporal remains the original research
            challenge.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CHALLENGES.map((c, i) => (
            <Link
              key={c.href}
              href={c.href}
              className={`ap-fade-up group rounded-md border border-slate-800 bg-slate-950/40 p-5 transition hover:border-cyan-500/40 hover:bg-slate-900/60 ${
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
              <p className="mt-2 text-sm text-slate-400">{c.body}</p>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-400">
          <Link href="/demo/accessible" className="hover:text-cyan-300">
            Accessible temporal
          </Link>
          <Link href="/challenge-lab" className="hover:text-cyan-300">
            Human-first comparison lab
          </Link>
          <Link href="/lab" className="hover:text-cyan-300">
            Agent Lab
          </Link>
        </div>
      </div>
    </main>
  );
}
