import type { PoseSample } from "@/lib/lab/poseTrail";

const THRESHOLD = Math.PI / 6;

/** Simple EMA low-pass on a 1D series. */
export function lowPassSeries(values: number[], alpha = 0.35): number[] {
  if (values.length === 0) return [];
  const out: number[] = [values[0]!];
  for (let i = 1; i < values.length; i += 1) {
    out.push(alpha * values[i]! + (1 - alpha) * out[i - 1]!);
  }
  return out;
}

/** Smooth pose trail with independent EMA on x/y. */
export function smoothTrail(
  samples: PoseSample[],
  alpha = 0.35,
): PoseSample[] {
  if (samples.length === 0) return [];
  const xs = lowPassSeries(
    samples.map((s) => s.x),
    alpha,
  );
  const ys = lowPassSeries(
    samples.map((s) => s.y),
    alpha,
  );
  return samples.map((s, i) => ({
    t: s.t,
    x: xs[i]!,
    y: ys[i]!,
  }));
}

/**
 * Piecewise-linear “spline” resample - densify path at uniform time steps
 * so direction changes are estimated from a reconstructed curve rather than
 * raw jittery samples.
 */
export function reconstructPath(
  samples: PoseSample[],
  stepMs = 100,
): PoseSample[] {
  if (samples.length < 2) return [...samples];
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const out: PoseSample[] = [];
  const t0 = sorted[0]!.t;
  const t1 = sorted[sorted.length - 1]!.t;
  for (let t = t0; t <= t1; t += stepMs) {
    let i = 0;
    while (i < sorted.length - 2 && sorted[i + 1]!.t < t) i += 1;
    const a = sorted[i]!;
    const b = sorted[Math.min(i + 1, sorted.length - 1)]!;
    const span = Math.max(1, b.t - a.t);
    const u = Math.min(1, Math.max(0, (t - a.t) / span));
    out.push({
      t,
      x: a.x + (b.x - a.x) * u,
      y: a.y + (b.y - a.y) * u,
    });
  }
  return out;
}

export function countChangesAdaptive(samples: PoseSample[]): number {
  if (samples.length < 4) return 0;
  const smoothed = smoothTrail(samples, 0.3);
  const path = reconstructPath(smoothed, 120);
  const velocities: { x: number; y: number }[] = [];
  for (let i = 1; i < path.length; i += 1) {
    const dt = (path[i]!.t - path[i - 1]!.t) / 1000;
    if (dt <= 0.02) continue;
    const vx = (path[i]!.x - path[i - 1]!.x) / dt;
    const vy = (path[i]!.y - path[i - 1]!.y) / dt;
    if (Math.hypot(vx, vy) < 12) continue;
    velocities.push({ x: vx, y: vy });
  }
  if (velocities.length < 2) return 0;

  // Merge near-duplicate headings, then count large turns
  const headings: number[] = [];
  for (const v of velocities) {
    const a = Math.atan2(v.y, v.x);
    const prev = headings[headings.length - 1];
    if (prev === undefined) {
      headings.push(a);
      continue;
    }
    let delta = Math.abs(a - prev);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    if (delta > THRESHOLD * 0.5) headings.push(a);
  }

  let changes = 0;
  for (let i = 1; i < headings.length; i += 1) {
    let delta = Math.abs(headings[i]! - headings[i - 1]!);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    if (delta > THRESHOLD) changes += 1;
  }
  return changes;
}

export function deriveAdaptive(
  trails: Record<string, PoseSample[]>,
  required: number,
): { objectId: string; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const [id, samples] of Object.entries(trails)) {
    counts[id] = countChangesAdaptive(samples);
  }
  const matches = Object.entries(counts).filter(([, c]) => c === required);
  if (matches.length >= 1) {
    const best = matches.sort(
      (a, b) => (trails[b[0]]?.length ?? 0) - (trails[a[0]]?.length ?? 0),
    )[0]!;
    return { objectId: best[0], counts };
  }
  const ranked = Object.entries(counts).sort(
    (a, b) => Math.abs(a[1] - required) - Math.abs(b[1] - required),
  );
  return {
    objectId: ranked[0]?.[0] ?? "object_1",
    counts,
  };
}
