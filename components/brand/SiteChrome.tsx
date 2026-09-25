import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SITE } from "@/lib/site";

type NavLink = {
  href: string;
  label: string;
  external?: boolean;
  hideOnMobile?: boolean;
};

type SiteHeaderProps = {
  links?: NavLink[];
  compact?: boolean;
};

const DEFAULT_LINKS: NavLink[] = [
  { href: "/demo", label: "Demos" },
  { href: "/lab", label: "Agent Lab" },
];

export function SiteHeader({ links, compact = false }: SiteHeaderProps) {
  const nav: NavLink[] = links ?? DEFAULT_LINKS;

  return (
    <header
      className={`relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 ${
        compact ? "px-4 py-4 sm:px-6" : "px-4 py-5 sm:px-6 sm:py-6"
      }`}
    >
      <BrandLogo size={compact ? "sm" : "md"} priority />
      <nav
        className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm text-slate-400 sm:gap-x-4"
        aria-label="Primary"
      >
        {nav.map((item) => {
          const className = `hover:text-slate-100${
            item.hideOnMobile ? " hidden sm:inline" : ""
          }`;
          return item.external ? (
            <a
              key={item.href}
              href={item.href}
              className={className}
              rel="noreferrer"
              target="_blank"
            >
              {item.label}
            </a>
          ) : (
            <Link key={item.href} href={item.href} className={className}>
              {item.label}
            </Link>
          );
        })}
        <a
          href={SITE.githubUrl}
          className="rounded border border-slate-700 px-2.5 py-1 text-slate-200 transition hover:border-cyan-500/50 hover:text-cyan-200"
          rel="noreferrer"
          target="_blank"
        >
          <span className="sm:hidden">GH</span>
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-slate-800/80 px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <BrandLogo size="sm" />
          <p className="text-sm text-slate-400">
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
          <p className="text-xs text-slate-500">
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
          Research Prototype - not production security infrastructure
        </p>
      </div>
    </footer>
  );
}
