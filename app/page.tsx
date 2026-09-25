import Link from "next/link";
import { SITE } from "@/lib/site";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden ap-glow">
      <div className="pointer-events-none absolute inset-0 ap-grid opacity-70" />
      <div className="pointer-events-none absolute inset-0 ap-scanline" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <span className="font-mono text-xs tracking-[0.28em] text-cyan-300/90 sm:text-sm sm:tracking-widest">
          AGENTPROOF
        </span>
        <nav
          className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm text-slate-400"
          aria-label="Primary"
        >
          <Link href="/demo" className="hover:text-slate-100">
            Demos
          </Link>
          <Link href="/lab" className="hover:text-slate-100">
            Agent Lab
          </Link>
          <a href="#why" className="hidden hover:text-slate-100 sm:inline">
            Why
          </a>
          <a href="#how" className="hidden hover:text-slate-100 sm:inline">
            How it works
          </a>
          <a
            href={SITE.githubUrl}
            className="rounded border border-slate-700 px-2.5 py-1 text-slate-200 transition hover:border-cyan-500/50 hover:text-cyan-200"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </nav>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-10">
        <p className="ap-fade-up font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-400/80 sm:text-xs sm:tracking-[0.35em]">
          Research prototype - open source
        </p>
        <h1 className="ap-fade-up-delay font-display mt-3 max-w-3xl text-4xl leading-[1.05] text-slate-50 sm:mt-4 sm:text-6xl lg:text-7xl">
          AgentProof
        </h1>
        <p className="ap-fade-up-delay-2 mt-5 max-w-2xl text-lg text-slate-200 sm:mt-6 sm:text-2xl">
          {SITE.tagline}
        </p>
        <p className="ap-fade-up-delay-2 mt-4 max-w-xl text-base text-slate-400 sm:text-lg">
          {SITE.supportingLine}
        </p>
        <div className="ap-fade-up-delay-2 mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-4">
          <Link
            href="/demo"
            className="inline-flex min-h-11 items-center justify-center rounded bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Try the demos
          </Link>
          <a
            href={SITE.githubUrl}
            className="inline-flex min-h-11 items-center justify-center rounded border border-slate-600 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-400"
            rel="noreferrer"
            target="_blank"
          >
            Fork on GitHub
          </a>
          <Link
            href="/lab"
            className="inline-flex min-h-11 items-center justify-center rounded border border-slate-600 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-400"
          >
            Agent Lab
          </Link>
        </div>
        <p className="mt-6 max-w-xl text-sm text-amber-200/90 sm:mt-8">
          Research Prototype - not production security infrastructure.
          AgentProof does not claim to be AI-proof or to prove that a user is human.
        </p>
      </section>

      <section
        id="why"
        className="relative z-10 border-t border-slate-800/80 bg-slate-950/40"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 sm:py-16 md:grid-cols-2 md:gap-12">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-400/80">
              Why this exists
            </p>
            <h2 className="font-display mt-3 text-2xl text-slate-50 sm:text-3xl">
              Agents can automate access. Core services still need supervision.
            </h2>
          </div>
          <div className="space-y-4 text-slate-400">
            <p>
              Automated agents increasingly hit login walls, APIs, and other
              high-value endpoints. Static checks are easy to script; claiming
              “prove you are human” does not hold against modern automation.
            </p>
            <p>
              AgentProof explores a different idea: keep ground truth on the
              server, measure interaction risk, raise the cost of reliable
              automation, and surface signals for human supervision before
              granting access to sensitive actions.
            </p>
            <p className="text-slate-300">
              The goal is not to make challenges impossible for AI. It is to make
              abuse measurable, adaptive, expensive to automate, hard to replay,
              and still usable for legitimate people.
            </p>
          </div>
        </div>
      </section>

      <section id="how" className="relative z-10 border-t border-slate-800/80">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-400/80">
            How it works
          </p>
          <h2 className="font-display mt-3 text-2xl text-slate-50 sm:text-3xl">
            Challenge → observe → verify → decide
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Issue",
                body: "Server creates a short-lived challenge and signed session. The browser never receives the answer key.",
              },
              {
                step: "02",
                title: "Interact",
                body: "You complete a short interaction - drag, place, guide, or observe - while the server reveals frames over time.",
              },
              {
                step: "03",
                title: "Verify",
                body: "Only the server checks ground truth. Client “success” flags are ignored.",
              },
              {
                step: "04",
                title: "Decide",
                body: "An explainable risk score returns allow, step up, or restrict - a signal, not a human probability.",
              },
            ].map((item) => (
              <li
                key={item.step}
                className="rounded-lg border border-slate-800/90 bg-slate-950/35 p-5"
              >
                <p className="font-mono text-xs text-cyan-400/90">{item.step}</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-100">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="security"
        className="relative z-10 border-t border-slate-800/80 bg-slate-950/40"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-16 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl text-slate-50 sm:text-3xl">
              What this prototype is - and is not
            </h2>
            <p className="mt-4 text-slate-400">
              Built for research, demos, and open experimentation. Useful for
              learning how server-authoritative challenges and risk signals can
              work together. Not a WAF, identity provider, or production bot
              defense product.
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Deeper notes in the repo:{" "}
              <a
                href={`${SITE.githubUrl}/blob/main/docs/case-study.md`}
                className="text-cyan-400 hover:underline"
                rel="noreferrer"
                target="_blank"
              >
                case study
              </a>
              ,{" "}
              <a
                href={`${SITE.githubUrl}/blob/main/docs/security.md`}
                className="text-cyan-400 hover:underline"
                rel="noreferrer"
                target="_blank"
              >
                security
              </a>
              ,{" "}
              <a
                href={`${SITE.githubUrl}/blob/main/docs/limitations.md`}
                className="text-cyan-400 hover:underline"
                rel="noreferrer"
                target="_blank"
              >
                limitations
              </a>
              .
            </p>
          </div>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="border-l-2 border-amber-500/40 pl-4">
              Ground truth stays on the server
            </li>
            <li className="border-l-2 border-amber-500/40 pl-4">
              Replay, tamper, and premature verify are blocked in Lab gates
            </li>
            <li className="border-l-2 border-amber-500/40 pl-4">
              Risk score = explainable interaction risk, not “% human”
            </li>
            <li className="border-l-2 border-amber-500/40 pl-4">
              MIT-licensed - fork it, break it, improve it
            </li>
          </ul>
        </div>
      </section>

      <section className="relative z-10 border-t border-slate-800/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 sm:py-16 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl text-slate-50 sm:text-3xl">
              Open for experimenters
            </h2>
            <p className="mt-3 text-slate-400">
              Clone the repo, run the demos, attack them in Agent Lab, and
              propose better challenges or risk rules. Keep the research-honest
              framing: measure cost and risk - do not invent AI-proof claims.
            </p>
          </div>
          <a
            href={SITE.githubUrl}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            rel="noreferrer"
            target="_blank"
          >
            View on GitHub
          </a>
        </div>
      </section>

      <footer className="relative z-10 border-t border-slate-800/80 px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-slate-400">
              Product &amp; Architecture by{" "}
              <a
                href={SITE.credit.github}
                className="text-cyan-400 hover:underline"
                rel="noreferrer"
                target="_blank"
              >
                {SITE.credit.name}
              </a>
            </p>
            <p className="mt-1 text-xs">
              <a
                href={SITE.credit.linkedin}
                className="hover:text-slate-300"
                rel="noreferrer"
                target="_blank"
              >
                LinkedIn
              </a>
              {" · "}
              <a
                href={SITE.githubUrl}
                className="hover:text-slate-300"
                rel="noreferrer"
                target="_blank"
              >
                {SITE.githubRepo}
              </a>
              {" · "}
              MIT License
            </p>
          </div>
          <p className="text-xs text-slate-600">
            Research Prototype - not production security
            infrastructure
          </p>
        </div>
      </footer>
    </main>
  );
}
