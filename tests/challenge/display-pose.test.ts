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
    expect(display.elapsedMs % 200 === 0 || display.elapsedMs === 0).toBe(true);
    const moved = display.poses.some((pose, i) => {
      const e = exact[i]!;
      return pose.x !== e.x || pose.y !== e.y;
    });
    expect(moved || display.elapsedMs !== 1200).toBe(true);
  });

  it("same time bucket shares base elapsed but wall-clock wobble can differ", () => {
    const challenge = generateTemporalChallenge({ difficulty: 1 });
    const a = toDisplayPoses(challenge, 410);
    const b = toDisplayPoses(challenge, 490);
    expect(a.elapsedMs).toBe(b.elapsedMs);
    // Wobble is wall-clock continuous — poses within a bucket need not be identical
    expect(a.poses.length).toBe(b.poses.length);
  });

  it("wobble keeps poses near the primary path (human-trackable)", () => {
    const challenge = generateTemporalChallenge({ difficulty: 1 });
    const exact = posesAtElapsed(challenge, 2000);
    const display = toDisplayPoses(challenge, 2000);
    for (let i = 0; i < exact.length; i += 1) {
      const dx = Math.abs(display.poses[i]!.x - exact[i]!.x);
      const dy = Math.abs(display.poses[i]!.y - exact[i]!.y);
      // Quantize + jitter + wobble should stay within a perceptual band
      expect(dx).toBeLessThan(48);
      expect(dy).toBeLessThan(48);
    }
  });
});
