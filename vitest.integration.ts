import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: "artifacts/api-server",
    include: ["src/**/__tests__/integration/**/*.int.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
    sequence: { concurrent: false },
    isolate: false,
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    globalSetup: ["./src/__tests__/global-setup.int.ts"],
    reporters: ["verbose", "junit"],
    outputFile: {
      junit: "test-results/integration.xml",
    },
  },
});
