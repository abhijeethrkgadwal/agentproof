/**
 * Phase 2 red-team: derive the correct object from public renderConfiguration.
 * Mirrors server direction-change logic (angle delta > π/6).
 * Measurement artifact only — not a product feature.
 */

const DIRECTION_CHANGE_THRESHOLD = Math.PI / 6;

/**
 * @param {{ endMs: number, velocity: { x: number, y: number } }[]} segments
 */
export function countDirectionChanges(segments) {
  if (!segments || segments.length <= 1) return 0;
  let changes = 0;
  for (let i = 1; i < segments.length; i += 1) {
    const prev = segments[i - 1].velocity;
    const curr = segments[i].velocity;
    const a1 = Math.atan2(prev.y, prev.x);
    const a2 = Math.atan2(curr.y, curr.x);
    let delta = Math.abs(a2 - a1);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    if (delta > DIRECTION_CHANGE_THRESHOLD) changes += 1;
  }
  return changes;
}

/**
 * @param {{ renderConfiguration: { requiredDirectionChanges: number, objects: { id: string, segments: unknown[] }[] } }} challenge
 */
export function deriveCorrectObjectId(challenge) {
  const required = challenge.renderConfiguration.requiredDirectionChanges;
  const matches = challenge.renderConfiguration.objects.filter(
    (object) => countDirectionChanges(object.segments) === required,
  );
  if (matches.length !== 1) {
    return {
      ok: false,
      error: `expected exactly 1 match for ${required} changes, found ${matches.length}`,
      matches: matches.map((m) => m.id),
      counts: Object.fromEntries(
        challenge.renderConfiguration.objects.map((o) => [
          o.id,
          countDirectionChanges(o.segments),
        ]),
      ),
    };
  }
  return {
    ok: true,
    correctObjectId: matches[0].id,
    requiredDirectionChanges: required,
    counts: Object.fromEntries(
      challenge.renderConfiguration.objects.map((o) => [
        o.id,
        countDirectionChanges(o.segments),
      ]),
    ),
  };
}
