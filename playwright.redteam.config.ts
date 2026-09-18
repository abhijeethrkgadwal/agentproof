import { defineConfig, devices } from "@playwright/test";

/** Uses the already-running demo server (no second `next dev`). */
const BASE = process.env.AGENTPROOF_BASE_URL ?? "http://127.0.0.1:43123";

export default defineConfig({
  testDir: "tests/redteam",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
