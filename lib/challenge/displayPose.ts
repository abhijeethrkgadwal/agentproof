import { createHash } from "crypto";
import type { ObjectPose, StoredChallenge } from "@/lib/challenge/types";
import { posesAtElapsed } from "@/lib/challenge/motion";

/**
 * Temporal bucket for the *base* display pose.
 * Keep moderate (~200ms): very coarse buckets create clarifying jumps that
 * can make trail reconstruction *easier*, not harder.
 */
export function getDisplayTimeBucketMs(): number {
  const raw = Number(process.env.AGENTPROOF_DISPLAY_TIME_BUCKET_MS ?? "200");
  return Number.isFinite(raw) && raw >= 50 ? raw : 200;
}

/** Spatial quantization grid for display coordinates (px). */
export function getDisplayGridPx(): number {
  const raw = Number(process.env.AGENTPROOF_DISPLAY_GRID_PX ?? "16");
  return Number.isFinite(raw) && raw >= 4 ? raw : 16;
}

/** Max deterministic display jitter amplitude (px). */
export function getDisplayJitterPx(): number {
  const raw = Number(process.env.AGENTPROOF_DISPLAY_JITTER_PX ?? "10");
  return Number.isFinite(raw) && raw >= 0 ? raw : 10;
}

/** EMA blend toward new display target (0–1). */
export function getDisplayEmaAlpha(): number {
  const raw = Number(process.env.AGENTPROOF_DISPLAY_EMA_ALPHA ?? "0.55");
  if (!Number.isFinite(raw)) return 0.55;
  return Math.min(0.9, Math.max(0.15, raw));
}

/**
 * Path-preserving wobble amplitude (px). Scrambles automated direction-change
 * counts while humans can still track the primary path.
 */
export function getDisplayWobblePx(): number {
  const raw = Number(process.env.AGENTPROOF_DISPLAY_WOBBLE_PX ?? "14");
  return Number.isFinite(raw) && raw >= 0 ? raw : 14;
}

function quantize(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

function hashUnit(seed: string): number {
  const digest = createHash("sha256").update(seed).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

export type DisplayPoseResult = {
  elapsedMs: number;
  poses: ObjectPose[];
};

/**
 * Display poses are intentionally NOT equal to internal ground-truth math.
 *
 * Light harden (Decision C):
 * - moderate time buckets (avoid clarifying mega-jumps)
 * - grid quantize + deterministic jitter
 * - continuous path wobble (wall-clock) to poison velocity-angle counting
 * - EMA across bucket transitions
 *
 * Ground-truth verification still uses server-side segment math only.
 */
export function toDisplayPoses(
  challenge: StoredChallenge,
  elapsedMs: number,
): DisplayPoseResult {
  const bucketMs = getDisplayTimeBucketMs();
  const grid = getDisplayGridPx();
  const jitterAmp = getDisplayJitterPx();
  const wobbleAmp = getDisplayWobblePx();
  const alpha = getDisplayEmaAlpha();
  const durationMs = challenge.renderConfiguration.durationMs;
  const exactElapsed = Math.max(0, Math.min(elapsedMs, durationMs));
  const displayElapsed = Math.min(
    durationMs,
    Math.floor(exactElapsed / bucketMs) * bucketMs,
  );

  const exactPoses = posesAtElapsed(challenge, displayElapsed);
  const { width, height } = challenge.renderConfiguration;
  const prevById = new Map(
    (challenge.lastDisplayPoses ?? []).map((p) => [p.id, p] as const),
  );

  const tSec = exactElapsed / 1000;

  const poses = exactPoses.map((pose) => {
    const unitX = hashUnit(
      `${challenge.challengeId}:${pose.id}:${displayElapsed}:x`,
    );
    const unitY = hashUnit(
      `${challenge.challengeId}:${pose.id}:${displayElapsed}:y`,
    );
    const jx = (unitX * 2 - 1) * jitterAmp;
    const jy = (unitY * 2 - 1) * jitterAmp;

    // Continuous wobble keyed by object — creates false atan2 swings for
    // trail reconstructors without removing the human-visible primary path.
    const phase = hashUnit(`${challenge.challengeId}:${pose.id}:wobble`);
    const freq = 1.4 + hashUnit(`${challenge.challengeId}:${pose.id}:freq`) * 1.8;
    const amp =
      wobbleAmp *
      (0.75 + hashUnit(`${challenge.challengeId}:${pose.id}:amp`) * 0.5);
    const wx = amp * Math.sin(2 * Math.PI * freq * tSec + phase * Math.PI * 2);
    const wy =
      amp *
      Math.cos(
        2 * Math.PI * (freq * 0.73) * tSec + phase * Math.PI * 1.7,
      );

    let x = quantize(pose.x + jx + wx, grid);
    let y = quantize(pose.y + jy + wy, grid);

    const prev = prevById.get(pose.id);
    if (prev && challenge.lastDisplayElapsedMs !== displayElapsed) {
      x = quantize(prev.x * (1 - alpha) + x * alpha, grid);
      y = quantize(prev.y * (1 - alpha) + y * alpha, grid);
    }

    const margin = pose.size;
    return {
      ...pose,
      x: Math.min(width - margin, Math.max(margin, x)),
      y: Math.min(height - margin, Math.max(margin, y)),
    };
  });

  return { elapsedMs: displayElapsed, poses };
}
