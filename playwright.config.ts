import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 43124);
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `${BASE}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      AGENTPROOF_SIGNING_SECRET:
        process.env.AGENTPROOF_SIGNING_SECRET ??
        "playwright-test-signing-secret-32b",
      // Short TTL so the expired-challenge e2e can observe 410 without long waits.
      AGENTPROOF_CHALLENGE_TTL_MS:
        process.env.AGENTPROOF_CHALLENGE_TTL_MS ?? "8000",
      AGENTPROOF_RATE_LIMIT_MAX: "1000",
    },
  },
});
