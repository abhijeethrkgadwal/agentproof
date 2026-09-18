import { describe, expect, it } from "vitest";
import { generateTemporalChallenge } from "@/lib/challenge/generator";
import { toDisplayPoses } from "@/lib/challenge/displayPose";
import { posesAtElapsed } from "@/lib/challenge/motion";

describe("display pose harden", () => {
  it("display poses differ from exact internal poses", () => {
    const challenge = generateTemporalChallenge({ difficulty: 1 });
    challenge.lifecycle = "active";
    challenge.startedAt = new Date().toISOString();
    const exact = posesAtElapsed(challenge, 1200);
    const display = toDisplayPoses(challenge, 1200);
    expect(display.elapsedMs % 320 === 0 || display.elapsedMs === 0).toBe(true);
    const moved = display.poses.some((pose, i) => {
      const e = exact[i]!;
      return pose.x !== e.x || pose.y !== e.y;
    });
    expect(moved || display.elapsedMs !== 1200).toBe(true);
  });

  it("same time bucket shares base elapsed", () => {
    const challenge = generateTemporalChallenge({ difficulty: 1 });
    const a = toDisplayPoses(challenge, 330);
    const b = toDisplayPoses(challenge, 600);
    expect(a.elapsedMs).toBe(b.elapsedMs);
    expect(a.poses.length).toBe(b.poses.length);
  });

  it("display poses stay inside the scene bounds", () => {
    const challenge = generateTemporalChallenge({ difficulty: 1 });
    const { width, height } = challenge.renderConfiguration;
    const display = toDisplayPoses(challenge, 2000);
    for (const pose of display.poses) {
      expect(pose.x).toBeGreaterThanOrEqual(0);
      expect(pose.y).toBeGreaterThanOrEqual(0);
      expect(pose.x).toBeLessThanOrEqual(width);
      expect(pose.y).toBeLessThanOrEqual(height);
    }
  });
});
