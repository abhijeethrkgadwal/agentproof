import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  /** mark = icon only; lockup = icon + wordmark (nav); stacked = full brand asset */
  variant?: "mark" | "lockup" | "stacked";
  href?: string | null;
  className?: string;
  /** Visual size for lockup/mark */
  size?: "sm" | "md" | "lg";
  priority?: boolean;
};

const MARK = "/brand/mark.png";
const STACKED = "/brand/logo-stacked.png";

const markPx = { sm: 28, md: 36, lg: 48 } as const;
const textClass = {
  sm: "text-base",
  md: "text-lg sm:text-xl",
  lg: "text-2xl sm:text-3xl",
} as const;

export function BrandLogo({
  variant = "lockup",
  href = "/",
  className = "",
  size = "md",
  priority = false,
}: BrandLogoProps) {
  const markSize = markPx[size];

  const inner =
    variant === "stacked" ? (
      <Image
        src={STACKED}
        alt="AgentProof"
        width={320}
        height={180}
        className="h-auto w-[min(100%,14rem)] sm:w-[min(100%,18rem)]"
        priority={priority}
      />
    ) : variant === "mark" ? (
      <Image
        src={MARK}
        alt="AgentProof"
        width={markSize}
        height={markSize}
        className="h-[1em] w-auto"
        style={{ height: markSize, width: "auto" }}
        priority={priority}
      />
    ) : (
      <span className={`inline-flex items-center gap-2.5 ${textClass[size]}`}>
        <Image
          src={MARK}
          alt=""
          width={markSize}
          height={markSize}
          className="shrink-0"
          style={{ height: markSize, width: "auto" }}
          priority={priority}
          aria-hidden
        />
        <span className="font-semibold tracking-tight">
          <span className="text-slate-50">Agent</span>
          <span className="text-cyan-300">Proof</span>
        </span>
      </span>
    );

  if (!href) {
    return <span className={`inline-flex ${className}`}>{inner}</span>;
  }

  return (
    <Link
      href={href}
      className={`inline-flex items-center transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${className}`}
      aria-label="AgentProof home"
    >
      {inner}
    </Link>
  );
}
