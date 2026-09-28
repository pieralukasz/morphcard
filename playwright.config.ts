import { defineConfig } from "@playwright/test";

type BrowserName = "chromium" | "firefox" | "webkit";

// Port of the static server for the examples. Pick a free one if 3311 is taken.
const port = Number(process.env.MORPHCARD_PORT ?? 3311);
// Opt into the full engine matrix: MORPHCARD_BROWSERS=chromium,firefox,webkit.
const browsers = (process.env.MORPHCARD_BROWSERS ?? "chromium").split(",") as BrowserName[];
for (const browser of browsers) {
  if (!["chromium", "firefox", "webkit"].includes(browser)) throw new Error(`Unknown browser: ${browser}`);
}

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
  projects: browsers.flatMap((browserName) => [
    {
      name: browserName === "chromium" ? "desktop" : `${browserName}-desktop`,
      use: { browserName, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
    },
    {
      name: browserName === "chromium" ? "phone" : `${browserName}-phone`,
      use: {
        browserName,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        ...(browserName === "firefox" ? {} : { isMobile: true }),
        hasTouch: true,
      },
    },
  ]),
  webServer: {
    command: `node scripts/serve.mjs`,
    env: { PORT: String(port) },
    url: `http://127.0.0.1:${port}/examples/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
