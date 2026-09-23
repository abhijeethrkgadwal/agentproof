import { afterEach, describe, expect, it } from "vitest";
import {
  checkFrameRateLimit,
  checkRateLimit,
  resetRateLimits,
} from "@/lib/security/rateLimit";

describe("frame rate limit budget", () => {
  afterEach(() => {
    resetRateLimits();
    delete process.env.AGENTPROOF_RATE_LIMIT_MAX;
    delete process.env.AGENTPROOF_FRAME_RATE_LIMIT_MAX;
  });

  it("general API budget still caps at the default max", async () => {
    process.env.AGENTPROOF_RATE_LIMIT_MAX = "60";
    resetRateLimits();
    let allowed = 0;
    let blocked = 0;
    for (let i = 0; i < 80; i += 1) {
      const r = await checkRateLimit("api:local");
      if (r.allowed) allowed += 1;
      else blocked += 1;
    }
    expect(allowed).toBe(60);
    expect(blocked).toBe(20);
  });

  it("frame budget sustains a full challenge + second run of polling", async () => {
    process.env.AGENTPROOF_FRAME_RATE_LIMIT_MAX = "1200";
    resetRateLimits();
    // ~12.5 polls/sec × 5s × 2 runs ≈ 125; stay well under 1200
    let allowed = 0;
    for (let i = 0; i < 200; i += 1) {
      const r = await checkFrameRateLimit("frame:local");
      if (r.allowed) allowed += 1;
    }
    expect(allowed).toBe(200);
  });
});
