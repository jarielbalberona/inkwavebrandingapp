import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/integration/**/*.integration.test.ts"],
    hookTimeout: 120_000,
    testTimeout: 120_000,
    fileParallelism: false,
  },
})
