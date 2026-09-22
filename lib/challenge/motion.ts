import type {
  ChallengeLifecycle,
  ObjectPose,
  RenderObject,
  StoredChallenge,
  TemporalRenderConfiguration,
  Vec2,
} from "@/lib/challenge/types";
import { isTemporalChallenge } from "@/lib/challenge/types";

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

/** Generic segment position (no bounce) for obstacles / gates. */
export function segmentPositionAt(
  start: Vec2,
  segments: { endMs: number; velocity: Vec2 }[],
  elapsedMs: number,
): Vec2 {
  let x = start.x;
  let y = start.y;
  let t0 = 0;
  for (const segment of segments) {
    const t1 = segment.endMs;
    const dt = Math.max(0, Math.min(elapsedMs, t1) - t0) / 1000;
    x += segment.velocity.x * dt;
    y += segment.velocity.y * dt;
    t0 = t1;
    if (elapsedMs <= t1) break;
  }
  return { x, y };
}

export function posesAtElapsed(
  challenge: StoredChallenge,
  elapsedMs: number,
): ObjectPose[] {
  if (!isTemporalChallenge(challenge)) {
    return [];
  }
  const cfg: TemporalRenderConfiguration = challenge.renderConfiguration;
  const t = Math.max(0, Math.min(elapsedMs, cfg.durationMs));
  return cfg.objects.map((object) => {
    const pos = positionAt(object, t, cfg.width, cfg.height);
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

export function circlesOverlap(
  a: Vec2,
  ar: number,
  b: Vec2,
  br: number,
  padding = 0,
): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = ar + br + padding;
  return dx * dx + dy * dy < r * r;
}

export function pointInCircle(p: Vec2, c: Vec2, r: number): boolean {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return dx * dx + dy * dy <= r * r;
}

export function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function pointInRect(
  p: Vec2,
  r: { x: number; y: number; width: number; height: number },
): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}
