import { createHash } from "crypto";
import type { ObjectPose, StoredChallenge } from "@/lib/challenge/types";
import { posesAtElapsed } from "@/lib/challenge/motion";

/**
 * Temporal bucket for the *base* display pose.
 * Phase 7: slightly coarser to reduce trail sample richness for adaptive filters.
 */
export function getDisplayTimeBucketMs(): number {
  const raw = Number(process.env.AGENTPROOF_DISPLAY_TIME_BUCKET_MS ?? "320");
  return Number.isFinite(raw) && raw >= 50 ? raw : 320;
}

/** Spatial quantization grid for display coordinates (px). */
export function getDisplayGridPx(): number {
  const raw = Number(process.env.AGENTPROOF_DISPLAY_GRID_PX ?? "28");
  return Number.isFinite(raw) && raw >= 4 ? raw : 28;
}

/** Max deterministic display jitter amplitude (px). */
export function getDisplayJitterPx(): number {
  const raw = Number(process.env.AGENTPROOF_DISPLAY_JITTER_PX ?? "10");
  return Number.isFinite(raw) && raw >= 0 ? raw : 10;
}

/** EMA blend toward new display target (0–1). */
export function getDisplayEmaAlpha(): number {
  const raw = Number(process.env.AGENTPROOF_DISPLAY_EMA_ALPHA ?? "0.5");
  if (!Number.isFinite(raw)) return 0.5;
  return Math.min(0.9, Math.max(0.15, raw));
}

/**
 * Low-frequency warp amplitude (px). Must survive attacker EMA/low-pass.
 */
export function getDisplayWobblePx(): number {
  const raw = Number(process.env.AGENTPROOF_DISPLAY_WOBBLE_PX ?? "28");
  return Number.isFinite(raw) && raw >= 0 ? raw : 28;
}

/** Per-object display time lag range (ms) — desynchronizes apparent turns. */
export function getDisplayLagMs(): number {
  const raw = Number(process.env.AGENTPROOF_DISPLAY_LAG_MS ?? "700");
  return Number.isFinite(raw) && raw >= 0 ? raw : 700;
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
 * Display poses ≠ internal GT math.
 *
 * Phase 7 polling residual fix:
 * Adaptive attackers EMA/low-pass away high-frequency wobble. So we apply:
 * - per-object time lag (shifts when turns appear)
 * - low-frequency spatial warp that survives smoothing
 * - coarser grid + time buckets
 */
export function toDisplayPoses(
  challenge: StoredChallenge,
  elapsedMs: number,
): DisplayPoseResult {
  const bucketMs = getDisplayTimeBucketMs();
  const grid = getDisplayGridPx();
  const jitterAmp = getDisplayJitterPx();
  const warpAmp = getDisplayWobblePx();
  const lagRange = getDisplayLagMs();
  const alpha = getDisplayEmaAlpha();
  const durationMs = challenge.renderConfiguration.durationMs;
  const exactElapsed = Math.max(0, Math.min(elapsedMs, durationMs));
  const displayElapsed = Math.min(
    durationMs,
    Math.floor(exactElapsed / bucketMs) * bucketMs,
  );

  const { width, height } = challenge.renderConfiguration;
  const prevById = new Map(
    (challenge.lastDisplayPoses ?? []).map((p) => [p.id, p] as const),
  );

  const tSec = exactElapsed / 1000;
  // Shared low-frequency warp (survives EMA) — same family for all objects
  const lfFreq = 0.18 + hashUnit(`${challenge.challengeId}:lf`) * 0.22; // ~0.18–0.4 Hz
  const lfPhase = hashUnit(`${challenge.challengeId}:lfphase`);

  const objectIds = challenge.renderConfiguration.objects.map((o) => o.id);
  const allExact = posesAtElapsed(challenge, displayElapsed);
  const byId = new Map(allExact.map((p) => [p.id, p] as const));

  const poses = objectIds.map((id) => {
    const lag =
      hashUnit(`${challenge.challengeId}:${id}:lag`) * lagRange;
    const laggedElapsed = Math.max(
      0,
      Math.min(durationMs, displayElapsed - lag),
    );
    const exactPose = posesAtElapsed(challenge, laggedElapsed).find(
      (p) => p.id === id,
    )!;

    // Contaminate path with another object's lagged pose so EMA cannot
    // recover clean GT turn structure (Phase 7 polling residual kill).
    const decoyIdx = Math.floor(
      hashUnit(`${challenge.challengeId}:${id}:decoy`) * objectIds.length,
    );
    const decoyId = objectIds[decoyIdx] ?? id;
    const decoyLag =
      hashUnit(`${challenge.challengeId}:${decoyId}:lag`) * lagRange * 0.5;
    const decoyElapsed = Math.max(
      0,
      Math.min(durationMs, displayElapsed - decoyLag),
    );
    const decoyPose =
      posesAtElapsed(challenge, decoyElapsed).find((p) => p.id === decoyId) ??
      byId.get(decoyId) ??
      exactPose;
    const mix =
      0.28 + hashUnit(`${challenge.challengeId}:${id}:mix`) * 0.22; // 0.28–0.50

    const unitX = hashUnit(
      `${challenge.challengeId}:${id}:${displayElapsed}:x`,
    );
    const unitY = hashUnit(
      `${challenge.challengeId}:${id}:${displayElapsed}:y`,
    );
    const jx = (unitX * 2 - 1) * jitterAmp;
    const jy = (unitY * 2 - 1) * jitterAmp;

    // Adversarial bias: correct object gets STRONGER mid/low-freq warp so
    // "minimum / closest turn-count" heuristics avoid the GT id.
    const isCorrect = id === challenge.groundTruth.correctObjectId;
    const ampScale = isCorrect ? 1.85 : 0.55;
    const objPhase = hashUnit(`${challenge.challengeId}:${id}:objphase`) * 0.6;
    const localAmp = warpAmp * ampScale;
    const wx =
      localAmp *
      Math.sin(2 * Math.PI * lfFreq * tSec + (lfPhase + objPhase) * Math.PI * 2);
    const wy =
      localAmp *
      Math.cos(
        2 * Math.PI * (lfFreq * 0.87) * tSec +
          (lfPhase + objPhase) * Math.PI * 1.5,
      );
    // Extra mid-freq on GT only (still visible as jitter, poisons counts)
    const mid =
      isCorrect
        ? localAmp *
          0.65 *
          Math.sin(2 * Math.PI * 0.85 * tSec + objPhase * 4)
        : 0;

    const blendedX = exactPose.x * (1 - mix) + decoyPose.x * mix;
    const blendedY = exactPose.y * (1 - mix) + decoyPose.y * mix;

    let x = quantize(blendedX + jx + wx + mid, grid);
    let y = quantize(blendedY + jy + wy + mid * 0.7, grid);

    const prev = prevById.get(id);
    if (prev && challenge.lastDisplayElapsedMs !== displayElapsed) {
      x = quantize(prev.x * (1 - alpha) + x * alpha, grid);
      y = quantize(prev.y * (1 - alpha) + y * alpha, grid);
    }

    const margin = exactPose.size;
    return {
      ...exactPose,
      x: Math.min(width - margin, Math.max(margin, x)),
      y: Math.min(height - margin, Math.max(margin, y)),
    };
  });

  return { elapsedMs: displayElapsed, poses };
}
