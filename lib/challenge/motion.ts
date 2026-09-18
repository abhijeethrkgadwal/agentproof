import type {
  ChallengeLifecycle,
  ObjectPose,
  RenderObject,
  StoredChallenge,
  Vec2,
} from "@/lib/challenge/types";

function bounce(value: number, min: number, max: number): number {
  if (max <= min) return min;
  let v = value;
  while (v < min || v > max) {
    if (v < min) v = min + (min - v);
    if (v > max) v = max - (v - max);
  }
  return v;
}

/** Server-side pose at elapsedMs from the private motion plan. */
export function positionAt(
  object: RenderObject,
  elapsedMs: number,
  width: number,
  height: number,
): Vec2 {
  let x = object.start.x;
  let y = object.start.y;
  let t0 = 0;

  for (const segment of object.segments) {
    const t1 = segment.endMs;
    const dt = Math.max(0, Math.min(elapsedMs, t1) - t0) / 1000;
    x += segment.velocity.x * dt;
    y += segment.velocity.y * dt;
    t0 = t1;
    if (elapsedMs <= t1) break;
  }

  const r = object.size;
  return {
    x: bounce(x, r, width - r),
    y: bounce(y, r, height - r),
  };
}

export function posesAtElapsed(
  challenge: StoredChallenge,
  elapsedMs: number,
): ObjectPose[] {
  const { width, height, objects } = challenge.renderConfiguration;
  const t = Math.max(0, Math.min(elapsedMs, challenge.renderConfiguration.durationMs));
  return objects.map((object) => {
    const pos = positionAt(object, t, width, height);
    return {
      id: object.id,
      shape: object.shape,
      color: object.color,
      size: object.size,
      x: pos.x,
      y: pos.y,
    };
  });
}

export function assertLifecycle(
  current: ChallengeLifecycle,
  allowed: ChallengeLifecycle[],
): { ok: true } | { ok: false; error: "invalid_lifecycle" } {
  if (!allowed.includes(current)) {
    return { ok: false, error: "invalid_lifecycle" };
  }
  return { ok: true };
}
