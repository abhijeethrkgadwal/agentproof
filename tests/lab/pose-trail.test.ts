import { describe, expect, it } from "vitest";
import {
  countDirectionChangesFromTrail,
  deriveFromPoseTrails,
  parseRequiredChanges,
} from "@/lib/lab/poseTrail";
import { computeAutomationCost } from "@/lib/lab/types";
import { median, p95 } from "@/lib/lab/metrics";

describe("lab pose trail", () => {
  it("parses required changes from instruction", () => {
    expect(
      parseRequiredChanges(
        "Select the object that changed direction exactly 2 times.",
      ),
    ).toBe(2);
  });

  it("counts direction changes from a synthetic trail", () => {
    const samples = [
      { t: 0, x: 0, y: 0 },
      { t: 500, x: 50, y: 0 },
      { t: 1000, x: 100, y: 0 },
      { t: 1500, x: 100, y: 50 },
      { t: 2000, x: 100, y: 100 },
      { t: 2500, x: 50, y: 100 },
      { t: 3000, x: 0, y: 100 },
    ];
    expect(countDirectionChangesFromTrail(samples)).toBeGreaterThanOrEqual(1);
  });

  it("derives unique matching object", () => {
    const trails = {
      object_1: [
        { t: 0, x: 0, y: 0 },
        { t: 1000, x: 40, y: 0 },
        { t: 2000, x: 80, y: 0 },
      ],
      object_2: [
        { t: 0, x: 0, y: 0 },
        { t: 500, x: 40, y: 0 },
        { t: 1000, x: 80, y: 0 },
        { t: 1500, x: 80, y: 40 },
        { t: 2000, x: 80, y: 80 },
        { t: 2500, x: 40, y: 80 },
        { t: 3000, x: 0, y: 80 },
      ],
    };
    const result = deriveFromPoseTrails(trails, 2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.objectId).toBe("object_2");
  });
});

describe("lab metrics", () => {
  it("computes automation cost and percentiles", () => {
    expect(
      computeAutomationCost({
        timeToSolveMs: 5000,
        actions: 2,
        framesObserved: 40,
      }),
    ).toBe(10);
    expect(median([1, 2, 3])).toBe(2);
    expect(p95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBeGreaterThanOrEqual(9);
  });
});
