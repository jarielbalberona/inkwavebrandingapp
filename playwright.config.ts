import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "PORT=3100 WEB_ORIGIN=http://127.0.0.1:4173 pnpm --filter @workspace/api e2e:server",
      url: "http://127.0.0.1:3100/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        "VITE_API_BASE_URL=http://127.0.0.1:3100 pnpm --filter web preview --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173/login",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
