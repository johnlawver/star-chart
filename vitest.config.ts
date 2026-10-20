import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // API tests share one Postgres test database, so files run one at a time.
    fileParallelism: false,
    globalSetup: ["test/global-setup.ts"],
  },
});
