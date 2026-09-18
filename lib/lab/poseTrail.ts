/**
 * Reconstruct approximate direction-change counts from an observed pose trail.
 * Used by L1 API observer — does not touch server ground truth.
 */

export type PoseSample = { t: number; x: number; y: number };

const THRESHOLD = Math.PI / 6;

export function countDirectionChangesFromTrail(samples: PoseSample[]): number {
  if (samples.length < 4) return 0;
  // Downsample to ~8–12 windows across the trail for stability
  const windows = Math.min(12, Math.max(6, Math.floor(samples.length / 3)));
  const step = Math.max(1, Math.floor((samples.length - 1) / windows));
  const picked: PoseSample[] = [];
  for (let i = 0; i < samples.length; i += step) {
    picked.push(samples[i]!);
  }
  const last = samples[samples.length - 1]!;
  if (picked[picked.length - 1] !== last) picked.push(last);

  const velocities: { x: number; y: number }[] = [];
  for (let i = 1; i < picked.length; i += 1) {
    const dt = (picked[i]!.t - picked[i - 1]!.t) / 1000;
    if (dt <= 0.02) continue;
    const vx = (picked[i]!.x - picked[i - 1]!.x) / dt;
    const vy = (picked[i]!.y - picked[i - 1]!.y) / dt;
    const speed = Math.hypot(vx, vy);
    if (speed < 15) continue; // ignore near-stationary noise
    velocities.push({ x: vx, y: vy });
  }
  if (velocities.length < 2) return 0;

  let changes = 0;
  for (let i = 1; i < velocities.length; i += 1) {
    const prev = velocities[i - 1]!;
    const curr = velocities[i]!;
    const a1 = Math.atan2(prev.y, prev.x);
    const a2 = Math.atan2(curr.y, curr.x);
    let delta = Math.abs(a2 - a1);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    if (delta > THRESHOLD) changes += 1;
  }
  return changes;
}

export function parseRequiredChanges(instruction: string): number | null {
  const match = instruction.match(/exactly\s+(\d+)\s+time/i);
  if (!match) return null;
  return Number(match[1]);
}

export function deriveFromPoseTrails(
  trails: Record<string, PoseSample[]>,
  required: number,
): { ok: true; objectId: string; counts: Record<string, number> } | { ok: false; counts: Record<string, number>; error: string } {
  const counts: Record<string, number> = {};
  for (const [id, samples] of Object.entries(trails)) {
    counts[id] = countDirectionChangesFromTrail(samples);
  }
  const matches = Object.entries(counts).filter(([, c]) => c === required);
  if (matches.length >= 1) {
    // Prefer unique match; if ambiguous, pick longest trail among matches
    const best = matches.sort(
      (a, b) => (trails[b[0]]?.length ?? 0) - (trails[a[0]]?.length ?? 0),
    )[0]!;
    return { ok: true, objectId: best[0], counts };
  }
  // Fallback: closest count
  const ranked = Object.entries(counts).sort(
    (a, b) => Math.abs(a[1] - required) - Math.abs(b[1] - required),
  );
  if (ranked.length === 0) {
    return { ok: false, counts, error: "no_trails" };
  }
  return {
    ok: true,
    objectId: ranked[0]![0],
    counts,
  };
}
