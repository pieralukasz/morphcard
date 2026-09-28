import { defineConfig } from "@playwright/test";

// Port of the static server for the examples. Pick a free one if 3311 is taken.
const port = Number(process.env.MORPHCARD_PORT ?? 3311);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
    },
    {
      name: "phone",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `node scripts/serve.mjs`,
    env: { PORT: String(port) },
    url: `http://127.0.0.1:${port}/examples/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
