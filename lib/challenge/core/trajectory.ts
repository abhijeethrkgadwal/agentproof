import type { InteractionSample } from "@/lib/challenge/core/types";

/**
 * Human-tolerant trajectory cleanup:
 * - drop non-monotonic timestamps (clock reset / out-of-order pointer events)
 * - enforce a minimum dt so dense pointer samples don't look like teleporting
 */
export function normalizeTrajectorySamples(
  samples: InteractionSample[],
  options: { minDtMs?: number; maxSpeedPxPerSec?: number } = {},
): InteractionSample[] {
  const minDtMs = options.minDtMs ?? 12;
  if (samples.length === 0) return [];
  const out: InteractionSample[] = [samples[0]!];
  for (let i = 1; i < samples.length; i += 1) {
    const prev = out[out.length - 1]!;
    const cur = samples[i]!;
    if (cur.t + 1 < prev.t) {
      // Ignore backwards clock glitches; keep earlier sample.
      continue;
    }
    const t = Math.max(cur.t, prev.t + minDtMs);
    out.push({ ...cur, t });
  }
  return out;
}

/** Returns false when a segment exceeds max speed (after normalize). */
export function trajectoryWithinSpeed(
  samples: InteractionSample[],
  maxSpeedPxPerSec: number,
): boolean {
  const normalized = normalizeTrajectorySamples(samples);
  for (let i = 1; i < normalized.length; i += 1) {
    const a = normalized[i - 1]!;
    const b = normalized[i]!;
    // Floor dt so bursty pointer coalescing doesn't look like teleporting.
    const dt = Math.max(40, b.t - a.t) / 1000;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    if (dist / dt > maxSpeedPxPerSec) {
      return false;
    }
  }
  return true;
}
