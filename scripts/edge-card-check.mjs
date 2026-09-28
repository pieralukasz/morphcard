// Repro of Łukasz's report: a hero card cut off by the bottom edge of the screen.
// For each viewport it leaves only a strip of a second-row card visible, clicks
// that strip with the mouse, and checks: the plan is a morph, the surface starts
// on the visible strip, Back ends on it, the panel rests in place, no ghosts.
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://127.0.0.1:3344";
const browser = await chromium.launch(process.env.RESOLVE ? { args: [`--host-resolver-rules=MAP ${process.env.RESOLVE.replace(":", " ")}`] } : {});
const out = [];
const failures = [];
for (const [w, h] of [[1440, 900], [1024, 768], [820, 672], [390, 844]]) {
  for (const strip of [0.08, 0.25, 0.6]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const i = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".mch-card")];
      const top0 = cards[0].getBoundingClientRect().top;
      return cards.findIndex((c) => c.getBoundingClientRect().top > top0 + 10);
    });
    await page.evaluate(
      ([i, v]) => {
        const r = document.querySelectorAll(".mch-card")[i].getBoundingClientRect();
        window.scrollBy({ top: r.top - (innerHeight - r.height * v), behavior: "instant" });
      },
      [i, strip],
    );
    await page.waitForTimeout(100);
    const shown = await page.evaluate((i) => {
      const r = document.querySelectorAll(".mch-card")[i].getBoundingClientRect();
      return { id: document.querySelectorAll(".mch-card")[i].dataset.id, box: [r.left, r.top, r.right, Math.min(innerHeight, r.bottom)].map((n) => Math.round(n)) };
    }, i);
    const surface = () =>
      page.evaluate(() => {
        const s = document.querySelector("body > .mcs-sheet");
        const b = s.getBoundingClientRect();
        const m = /inset\(([^)]*)\)/.exec(getComputedStyle(s).clipPath);
        const v = (m?.[1] ?? "0px").split(" round ")[0].trim().split(/\s+/).map(Number.parseFloat);
        const [t, rt = t, bt = t, l = rt] = v;
        return [b.left + l, b.top + t, b.right - rt, b.bottom - bt].map((n) => Math.round(n));
      });
    const pause = (ms) =>
      page.evaluate((t) => {
        for (const a of document.getAnimations()) {
          if (a instanceof CSSTransition) continue;
          a.pause();
          a.currentTime = t;
        }
      }, ms);
    const resume = () => page.evaluate(() => { for (const a of document.getAnimations()) if (a.playState === "paused") a.play(); });
    const near = (a, b) => a.every((n, k) => Math.abs(n - b[k]) <= 1);

    await page.mouse.click(shown.box[0] + 30, shown.box[1] + 4);
    await page.waitForFunction(() => document.querySelector("body > .mcs-sheet")?.getAttribute("data-morph-state") === "opening", null, { timeout: 3000 });
    await pause(0);
    const start = await surface();
    await resume();
    await page.waitForFunction(() => document.querySelector("body > .mcs-sheet")?.getAttribute("data-morph-state") === "open", null, { timeout: 5000 });
    const rest = await page.evaluate(() => getComputedStyle(document.querySelector("body > .mcs-sheet")).translate);
    await page.locator("body > .mcs-sheet .mcs-back").click();
    await pause(299);
    const end = await surface();
    await resume();
    await page.waitForFunction(() => document.querySelector("body > .mcs-sheet")?.hidden, null, { timeout: 5000 });
    const ghosts = await page.locator("[data-morph-ghost]").count();
    const row = { w, h, strip, card: shown.id, shown: shown.box, start, end, rest, ghosts, errors };
    out.push(row);
    if (!near(start, shown.box)) failures.push(`${w} ${strip}: open does not start on the card ${JSON.stringify(row)}`);
    if (!near(end, shown.box)) failures.push(`${w} ${strip}: Back does not end on the card ${JSON.stringify(row)}`);
    if (rest !== "none") failures.push(`${w} ${strip}: panel left moved (${rest})`);
    if (ghosts || errors.length) failures.push(`${w} ${strip}: ghosts ${ghosts}, errors ${errors}`);
    await page.close();
  }
}
console.log(JSON.stringify({ out, failures }, null, 1));
await browser.close();
process.exit(failures.length ? 1 : 0);
