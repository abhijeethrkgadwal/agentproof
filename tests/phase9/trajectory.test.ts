import { describe, expect, it } from "vitest";
import {
  normalizeTrajectorySamples,
  trajectoryWithinSpeed,
} from "@/lib/challenge/core/trajectory";
import type { InteractionSample } from "@/lib/challenge/core/types";

describe("trajectory helpers", () => {
  it("drops backwards timestamps from clock resets", () => {
    const samples: InteractionSample[] = [
      { t: 0, x: 0, y: 0, kind: "down" },
      { t: 50, x: 10, y: 0, kind: "move" },
      { t: 40, x: 20, y: 0, kind: "move" }, // backwards glitch
      { t: 100, x: 30, y: 0, kind: "up" },
    ];
    const out = normalizeTrajectorySamples(samples);
    expect(out.map((s) => s.x)).toEqual([0, 10, 30]);
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i]!.t).toBeGreaterThanOrEqual(out[i - 1]!.t);
    }
  });

  it("enforces min dt without rejecting human flicks under raised cap", () => {
    // Burst samples get a 40ms speed-check floor → 40px/0.04s = 1000 px/s.
    const samples: InteractionSample[] = [
      { t: 0, x: 0, y: 0, kind: "down" },
      { t: 2, x: 40, y: 0, kind: "move" },
      { t: 4, x: 80, y: 0, kind: "move" },
      { t: 80, x: 120, y: 0, kind: "up" },
    ];
    expect(trajectoryWithinSpeed(samples, 1600)).toBe(true);
  });

  it("rejects extreme teleport segments", () => {
    const samples: InteractionSample[] = [
      { t: 0, x: 0, y: 0, kind: "down" },
      { t: 40, x: 900, y: 0, kind: "move" },
    ];
    expect(trajectoryWithinSpeed(samples, 800)).toBe(false);
  });
});
