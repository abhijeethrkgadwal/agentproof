import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden ap-glow">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-70" />
      <div className="pointer-events-none absolute inset-0 ap-scanline" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-mono text-sm tracking-widest text-cyan-300/90">
          AGENTPROOF
        </span>
        <nav className="flex gap-4 text-sm text-slate-400">
          <Link href="/demo" className="hover:text-slate-100">
            Demo
          </Link>
          <Link href="/study" className="hover:text-slate-100">
            Study
          </Link>
          <Link href="/lab" className="hover:text-slate-100">
            Agent Lab
          </Link>
          <a href="#architecture" className="hover:text-slate-100">
            Architecture
          </a>
        </nav>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-24 pt-10">
        <p className="ap-fade-up font-mono text-xs uppercase tracking-[0.35em] text-cyan-400/80">
          Verification research prototype
        </p>
        <h1 className="ap-fade-up-delay font-display mt-4 max-w-3xl text-5xl leading-[1.05] text-slate-50 sm:text-7xl">
          AgentProof
        </h1>
        <p className="ap-fade-up-delay-2 mt-6 max-w-xl text-lg text-slate-300 sm:text-xl">
          Adaptive verification for the agentic web.
        </p>
        <div className="ap-fade-up-delay-2 mt-10 flex flex-wrap gap-4">
          <Link
            href="/demo"
            className="rounded bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Try Demo
          </Link>
            <Link
              href="/study"
              className="rounded border border-slate-600 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-400"
            >
              Human Study
            </Link>
            <Link
              href="/lab"
              className="rounded border border-slate-600 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-400"
            >
              Agent Lab
            </Link>
        </div>
        <p className="mt-8 max-w-lg text-sm text-slate-500">
          AgentProof does not claim to be AI-proof. It measures interaction risk
          and makes automated abuse more expensive and less reliable.
        </p>
      </section>

      <section
        id="architecture"
        className="relative z-10 border-t border-slate-800/80 bg-slate-950/40"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl text-slate-50">Architecture</h2>
            <p className="mt-3 text-slate-400">
              Server-authored challenges, HMAC-signed tokens, one-time nonces, and
              an explainable risk engine. The browser never decides pass/fail.
            </p>
          </div>
          <ol className="space-y-4 font-mono text-sm text-slate-300">
            <li className="border-l-2 border-cyan-500/50 pl-4">
              POST /api/challenge — issue scene identity (no motion plan)
            </li>
            <li className="border-l-2 border-cyan-500/50 pl-4">
              Start → progressive /frame poses on server clock; answer stays server-side
            </li>
            <li className="border-l-2 border-cyan-500/50 pl-4">
              POST /api/verify — signature, session, lifecycle, active window, ground truth, risk
            </li>
            <li className="border-l-2 border-cyan-500/50 pl-4">
              Decision: allow · step_up · restrict
            </li>
          </ol>
        </div>
      </section>
    </main>
  );
}
