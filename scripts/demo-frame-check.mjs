// The home page demo must not move while it animates, and "Back" must land
// the card exactly where it will stay. Fails with exit 1 otherwise.
//   BASE=http://127.0.0.1:3302 node scripts/demo-frame-check.mjs
//   RESOLVE=host:ip pins a hostname the local resolver does not know yet.
import { chromium } from "@playwright/test";

const base = process.env.BASE ?? "http://127.0.0.1:3302";
const resolve = process.env.RESOLVE?.split(":");
const browser = await chromium.launch({
  args: resolve ? [`--host-resolver-rules=MAP ${resolve[0]} ${resolve[1]}`] : [],
});
const failures = [];
const report = {};

for (const [label, width, height] of [
  ["desktop", 1440, 900],
  ["tablet", 1024, 800],
  ["phone", 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-live-demo][data-ready]", { timeout: 30000 });
  const demo = page.locator("[data-live-demo]");

  // Samples the frame on every animation frame while `action` runs.
  const sample = (action) =>
    page.evaluate(async (which) => {
      const d = document.querySelector("[data-live-demo]");
      const boxes = new Set();
      let stop = false;
      const row = d.nextElementSibling;
      const tick = () => {
        const r = d.getBoundingClientRect();
        const c = row ? row.getBoundingClientRect() : r;
        boxes.add(`frame ${r.left.toFixed(1)},${r.width.toFixed(1)} controls ${c.width.toFixed(1)}x${c.height.toFixed(1)}`);
        if (!stop) requestAnimationFrame(tick);
      };
      tick();
      if (which === "open") d.querySelector('.mc-card[data-id="2042"] .mc-card-hit').click();
      else d.querySelector(".mc-sheet .mc-back").click();
      const target = which === "open" ? "open" : null;
      await new Promise((done) => {
        const check = () => {
          const sheet = d.querySelector(".mc-sheet");
          const finished = target ? sheet.getAttribute("data-morph-state") === "open" : sheet.hidden;
          if (finished && !document.getAnimations().some((a) => a.playState === "running" && a.effect?.getComputedTiming().endTime > 0)) done();
          else setTimeout(check, 16);
        };
        check();
      });
      stop = true;
      await new Promise((r) => requestAnimationFrame(r));
      tick();
      return [...boxes];
    }, action);

  const fit = await page.evaluate(() => {
    const r = document.querySelector("[data-live-demo]").getBoundingClientRect();
    return { right: Math.round(r.right), page: document.documentElement.scrollWidth, viewport: innerWidth };
  });
  const controlsHeight = await page.evaluate(() => document.querySelector("[data-live-demo]").nextElementSibling?.getBoundingClientRect().height ?? 0);
  if (controlsHeight > 40) failures.push(`${label}: the demo controls wrap onto two lines (${controlsHeight}px)`);
  if (fit.right > fit.viewport || fit.page > fit.viewport) {
    failures.push(`${label}: demo overflows the viewport (frame right ${fit.right}, page ${fit.page}, viewport ${fit.viewport})`);
  }

  const opening = await sample("open");
  const closing = await sample("back");

  // Where the flying copy of the card sits at the last frames of Back, and
  // where the real card is once everything has settled.
  await demo.getByRole("button", { name: /Open delivery 2042/ }).click();
  await page.waitForFunction(() => document.querySelector("[data-live-demo] .mc-sheet")?.getAttribute("data-morph-state") === "open");
  await page.waitForFunction(() => !document.getAnimations().some((a) => a.playState === "running" && a.effect?.getComputedTiming().endTime > 0));
  const landing = await page.evaluate(async () => {
    const d = document.querySelector("[data-live-demo]");
    const card = () => d.querySelector('.mc-card[data-id="2042"]').getBoundingClientRect();
    d.querySelector(".mc-sheet .mc-back").click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Jump to the last frame of the close and read the ghost there.
    const anims = document.getAnimations().filter((a) => a.effect?.getComputedTiming().endTime > 0);
    const end = Math.max(...anims.map((a) => a.effect.getComputedTiming().endTime));
    for (const a of anims) {
      a.pause();
      a.currentTime = end - 1;
    }
    const ghost = d.querySelector("[data-morph-ghost]")?.getBoundingClientRect();
    for (const a of anims) a.play();
    await new Promise((done) => {
      const check = () => (d.querySelector(".mc-sheet").hidden && !document.getAnimations().some((a) => a.playState === "running" && a.effect?.getComputedTiming().endTime > 0) ? done() : setTimeout(check, 16));
      check();
    });
    const settled = card();
    const round = (r) => r && [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
    return { ghost: round(ghost), card: round(settled) };
  });

  report[label] = { fit, opening, closing, landing };
  if (opening.length !== 1) failures.push(`${label}: frame moved while opening: ${opening.join(" | ")}`);
  if (closing.length !== 1) failures.push(`${label}: frame moved during Back: ${closing.join(" | ")}`);
  if (!landing.ghost) failures.push(`${label}: no card ghost at the end of Back`);
  else if (landing.ghost.some((v, i) => Math.abs(v - landing.card[i]) > 1)) {
    failures.push(`${label}: Back lands at ${landing.ghost} but the card settles at ${landing.card}`);
  }
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ report, failures }, null, 2));
if (failures.length) process.exit(1);
