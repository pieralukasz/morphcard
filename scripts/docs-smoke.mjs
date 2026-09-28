// Checks every docs page: HTTP status, console errors, and that the live
// demo on the home page opens and closes.
//   BASE=http://127.0.0.1:3302 node scripts/docs-smoke.mjs
import { chromium } from "@playwright/test";

const base = process.env.BASE ?? "http://127.0.0.1:3302";
const pages = [
  "/",
  "/docs",
  "/docs/getting-started",
  "/docs/api",
  "/docs/anatomy",
  "/docs/interruptions",
  "/docs/accessibility",
  "/docs/pitfalls",
  "/docs/recipes",
  "/docs/view-transitions",
  "/llms.txt",
  "/api/search",
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`${page.url()}: ${m.text()}`);
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});

const results = [];
for (const path of pages) {
  const res = await page.goto(base + path, { waitUntil: "networkidle", timeout: 60000 });
  results.push(`${res?.status()} ${path}`);
}

// The live demo: open a card, check the sheet, close it.
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-live-demo][data-ready]", { timeout: 30000 });
const demo = page.locator("[data-live-demo]");
await demo.getByRole("button", { name: /Open delivery 2042/ }).click();
await page.waitForFunction(() => document.querySelector("[data-live-demo] .mc-sheet")?.getAttribute("data-morph-state") === "open", null, { timeout: 10000 });
const heading = await demo.locator(".mc-head .mc-route").innerText();
await demo.getByRole("button", { name: "Back" }).click();
await page.waitForFunction(() => document.querySelector("[data-live-demo] .mc-sheet")?.hidden === true, null, { timeout: 10000 });
const leftovers = await page.evaluate(() => document.querySelectorAll("[data-morph-ghost]").length);

// Videos referenced by the pages exist.
const videos = await page.evaluate(async () => {
  const urls = new Set();
  for (const path of ["/", "/docs", "/docs/anatomy", "/docs/interruptions", "/docs/accessibility"]) {
    const html = await (await fetch(path)).text();
    for (const m of html.matchAll(/(?:src|poster)="([^"]+\.(?:mp4|png))"/g)) urls.add(m[1]);
  }
  const out = [];
  for (const u of urls) out.push(`${(await fetch(u, { method: "HEAD" })).status} ${u}`);
  return out;
});

console.log(JSON.stringify({ results, demo: { heading, leftovers }, videos, errors }, null, 2));
await browser.close();
if (errors.length || results.some((r) => !r.startsWith("200")) || videos.some((v) => !v.startsWith("200"))) process.exit(1);
