import { defineConfig } from "vitest/config";

// The browser smoke test. Run with `npm run test:smoke`, which builds the web pages first.
export default defineConfig({
  test: {
    include: ["test/smoke/**/*.smoke.ts"],
    globalSetup: ["test/global-setup.ts"],
    testTimeout: 30_000,
  },
});
