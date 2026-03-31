import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "api-unit",
      root: "artifacts/api-server",
      include: ["src/**/__tests__/**/*.unit.test.ts"],
      environment: "node",
      globals: true,
    },
  },
  {
    test: {
      name: "api-integration",
      root: "artifacts/api-server",
      include: ["src/**/__tests__/**/*.int.test.ts"],
      environment: "node",
      globals: true,
      testTimeout: 30000,
      hookTimeout: 30000,
      sequence: { concurrent: false },
    },
  },
  {
    test: {
      name: "api-e2e",
      root: "artifacts/api-server",
      include: ["src/**/__tests__/**/*.api.test.ts"],
      environment: "node",
      globals: true,
      testTimeout: 30000,
      hookTimeout: 60000,
      sequence: { concurrent: false },
    },
  },
  {
    test: {
      name: "mobile-unit",
      root: "artifacts/staff-app",
      include: ["**/__tests__/**/*.unit.test.ts"],
      environment: "node",
      globals: true,
    },
  },
]);
