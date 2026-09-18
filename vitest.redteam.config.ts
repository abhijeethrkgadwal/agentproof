import { defineConfig } from "vitest/config";
import path from "path";

/** Runs Phase 2 redteam measurement tests (expect failure after Phase 3). */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/redteam/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
