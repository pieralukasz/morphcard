// Reproducible engine setup benchmark. Build fixtures, run scripts/serve.mjs,
// then: node scripts/perf-check.mjs /tmp/before.js examples/dist/engine.js
// CPU=4 SAMPLES=30 OUT=/tmp/results.json are optional. This is not an FPS/device benchmark.
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const paths = process.argv.slice(2);
if (!paths.length) paths.push("examples/dist/engine.js");
const browser = await chromium.launch();
const results = [];
const samples = Number(process.env.SAMPLES ?? 30);
const cpu = Number(process.env.CPU ?? 4);
try {
  for (const path of paths) {
    const body = await readFile(path, "utf8");
    for (const [name, cards, pairs, blocks] of [
      ["demo", 0, 0, 0],
      ["small", 6, 4, 4],
      ["large-list", 200, 4, 4],
      ["rich-sheet", 30, 24, 32],
    ]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route("**/examples/dist/engine.js", (route) =>
        route.fulfill({ contentType: "text/javascript", body }),
      );
      await page.goto(`${process.env.BASE ?? "http://127.0.0.1:3301"}/examples/`);
      await page.waitForFunction(() => window.demo);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
      await cdp.send("Performance.enable");
      await page.evaluate(
        async ({ cards, pairs, blocks }) => {
          if (cards) {
            window.morph.destroy();
            const { createMorph } = await import("/examples/dist/engine.js");
            document.head.insertAdjacentHTML(
              "beforeend",
              `<style>
          [hidden]{display:none!important} body{margin:0;font:16px Arial} #list{position:absolute;inset:0;overflow:auto;padding:24px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-content:start}
          .card{padding:16px;border:1px solid #ddd;border-radius:16px;background:white} .shared{display:grid;grid-template-columns:repeat(4,1fr);gap:4px} .shared span{font-size:14px;line-height:20px}
          #detail{position:fixed;inset:24px 20%;padding:24px;overflow:auto;background:#eee;border-radius:20px} #detail .shared span{font-size:18px;line-height:26px}
          .block{height:28px;display:flex;gap:4px}.block i{font-size:10px} #shade{position:fixed;inset:0;background:#0005}
        </style>`,
            );
            const shared = `<div class="shared">${Array.from({ length: pairs }, (_, i) => `<span data-morph="p${i}">Text ${i}</span>`).join("")}</div>`;
            document.body.innerHTML = `<main id="list">${Array.from({ length: cards }, () => `<article class="card"><button>Open</button>${shared}<p>Card metadata</p></article>`).join("")}</main><div id="shade" hidden></div><section id="detail" hidden><button data-morph-close>Back</button>${shared}${Array.from({ length: blocks }, () => `<div class="block" data-morph-stagger>${"<i>Content</i>".repeat(12)}</div>`).join("")}</section>`;
            window.morph = createMorph({
              sheet: document.querySelector("#detail"),
              background: document.querySelector("#list"),
              scrim: document.querySelector("#shade"),
            });
          }
          const card = document.querySelector('.card, .mc-card[data-id="2042"]');
          window.perfCycle = async (count, instrument = false) => {
            const timings = { open: [], close: [] };
            const calls = { style: 0, rect: 0, queryAll: 0 };
            const style = window.getComputedStyle;
            const rect = Element.prototype.getBoundingClientRect;
            const queryAll = Element.prototype.querySelectorAll;
            if (instrument) {
              window.getComputedStyle = (...args) => {
                calls.style++;
                return style(...args);
              };
              Element.prototype.getBoundingClientRect = function (...args) {
                calls.rect++;
                return rect.apply(this, args);
              };
              Element.prototype.querySelectorAll = function (...args) {
                calls.queryAll++;
                return queryAll.apply(this, args);
              };
            }
            try {
              for (let i = 0; i < count; i++) {
                for (const phase of ["open", "close"]) {
                  const start = performance.now();
                  const done = phase === "open" ? window.morph.open(card) : window.morph.close();
                  timings[phase].push(performance.now() - start);
                  for (const a of document.getAnimations()) if (a.playState !== "finished") a.finish();
                  await done;
                }
              }
            } finally {
              window.getComputedStyle = style;
              Element.prototype.getBoundingClientRect = rect;
              Element.prototype.querySelectorAll = queryAll;
            }
            return { timings, calls };
          };
          await window.perfCycle(5);
        },
        { cards, pairs, blocks },
      );
      const before = Object.fromEntries(
        (await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]),
      );
      const { timings } = await page.evaluate((n) => window.perfCycle(n), samples);
      const after = Object.fromEntries(
        (await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]),
      );
      const { calls } = await page.evaluate(() => window.perfCycle(1, true));
      const stats = (values) => {
        values.sort((a, b) => a - b);
        return {
          medianMs: +values[Math.floor(values.length / 2)].toFixed(2),
          p95Ms: +values[Math.ceil(values.length * 0.95) - 1].toFixed(2),
        };
      };
      const result = {
        path,
        name,
        cpu,
        samples,
        open: stats(timings.open),
        close: stats(timings.close),
        callsPerCycle: calls,
        browserPerCycle: Object.fromEntries(
          ["LayoutCount", "RecalcStyleCount", "LayoutDuration", "RecalcStyleDuration"].map((key) => [
            key,
            +(((after[key] - before[key]) / samples) * (key.endsWith("Duration") ? 1000 : 1)).toFixed(3),
          ]),
        ),
      };
      results.push(result);
      console.log(JSON.stringify(result));
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (process.env.OUT) await writeFile(process.env.OUT, JSON.stringify(results, null, 2) + "\n");
