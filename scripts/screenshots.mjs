// Screenshots of the docs site and the demo for review.
//   BASE=http://127.0.0.1:3302 DEMO=http://127.0.0.1:3301 OUT=... node scripts/screenshots.mjs
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const base = process.env.BASE ?? "http://127.0.0.1:3302";
const demoBase = process.env.DEMO ?? "http://127.0.0.1:3301";
const out = process.env.OUT ?? "screenshots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const shots = [];

const contexts = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  iphone13: { ...devices["iPhone 13"], defaultBrowserType: undefined },
};
delete contexts.iphone13.defaultBrowserType;

for (const [device, options] of Object.entries(contexts)) {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ ...options, colorScheme: theme });
    // Fumadocs follows next-themes; set the stored choice too.
    await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
    const page = await context.newPage();
    for (const [name, path] of [
      ["landing", "/"],
      ["anatomy", "/docs/anatomy"],
    ]) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      if (path === "/") await page.waitForSelector("[data-live-demo][data-ready]");
      await page.waitForTimeout(400);
      const file = `${out}/docs-${name}-${device}-${theme}.png`;
      await page.screenshot({ path: file, fullPage: true });
      shots.push(file);
    }
    await context.close();
  }
}

// The demo: list, mid-open, open, mid-close. Animations are paused at a
// point in time so the frame is exact.
for (const [device, w, h, dpr] of [
  ["phone", 390, 844, 3],
  ["desktop", 1280, 800, 1],
]) {
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await page.goto(`${demoBase}/examples/index.html?layout=frame&w=${w}&h=${h}${theme === "dark" ? "&theme=dark" : ""}`);
    await page.waitForSelector("html[data-ready]", { state: "attached" });
    await page.evaluate(() => document.fonts.ready);
    const snap = async (name) => {
      const file = `${out}/demo-${device}-${theme}-${name}.png`;
      await page.screenshot({ path: file });
      shots.push(file);
    };
    const seek = (ms) =>
      page.evaluate((ms) => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = ms;
        }
      }, ms);
    await snap("1-list");
    await page.evaluate(() => {
      window.demo.open("2042");
      for (const a of document.getAnimations()) a.pause();
    });
    await seek(160);
    await snap("2-mid-open");
    await page.evaluate(() => {
      for (const a of document.getAnimations()) a.play();
    });
    await page.waitForFunction(() => window.morph.state === "open");
    await page.waitForTimeout(200);
    await snap("3-open");
    await page.evaluate(() => {
      window.demo.close();
      for (const a of document.getAnimations()) a.pause();
    });
    await seek(120);
    await snap("4-mid-close");
    await page.close();
  }
}

console.log(shots.join("\n"));
await browser.close();
