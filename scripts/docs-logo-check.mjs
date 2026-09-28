// Check the city glyph throughout the flight, including cards cut by the viewport.
// Build docs-site first, then serve its out/ directory:
//   BASE=http://127.0.0.1:3341 node scripts/docs-logo-check.mjs
import assert from "node:assert/strict";
import { chromium, firefox, webkit } from "@playwright/test";

const base = process.env.BASE ?? "http://127.0.0.1:3341";
const browser = await ({ chromium, firefox, webkit }[process.env.BROWSER ?? "chromium"]).launch();
const card = '.mch-card[data-id="kyoto"]';
const sheet = "body > .mcs-sheet";
const glyph = `${sheet} .mcs-body .mch-glyph`;
const rect = (el) => {
  const b = el.getBoundingClientRect();
  return { x: b.x, y: b.y, width: b.width, height: b.height };
};
const near = (actual, expected, label) => {
  for (const key of Object.keys(expected)) {
    assert.ok(Math.abs(actual[key] - expected[key]) < 1, `${label}: ${key} ${actual[key]} != ${expected[key]}`);
  }
};

try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    for (const position of ["center", "top", "bottom"]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "no-preference" });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base, { waitUntil: "networkidle" });
      await page.waitForSelector(sheet, { state: "attached" });
      await page.evaluate(({ card, position }) => {
        const b = document.querySelector(card).getBoundingClientRect();
        const top = position === "top" ? -b.height * 0.2 : position === "bottom" ? innerHeight - b.height * 0.4 : (innerHeight - b.height) / 2;
        scrollBy({ top: b.top - top, behavior: "instant" });
      }, { card, position });
      const from = await page.locator(`${card} .mch-glyph`).evaluate(rect);
      const freeze = (ms) => page.evaluate((ms) => {
        for (const a of document.getAnimations()) {
          if (a instanceof CSSTransition) continue;
          a.pause();
          a.currentTime = ms;
        }
      }, ms);
      const resume = () => page.evaluate(() => {
        for (const a of document.getAnimations()) if (a.playState === "paused") a.play();
      });
      const start = (selector) => page.evaluate((selector) => {
        document.querySelector(selector).click();
        for (const a of document.getAnimations()) {
          if (a instanceof CSSTransition) continue;
          a.pause();
          a.currentTime = 0;
        }
      }, selector);
      const sample = () => page.locator(glyph).evaluate(rect);
      const closed = () => page.waitForFunction((selector) => document.querySelector(selector).hidden, sheet);
      const label = `${width}px ${position}`;

      await start(`${card} .mcs-hit`);
      near(await sample(), from, `${label} first frame`);
      const frames = [];
      for (const ms of [0, 40, 80, 120, 200, 300, 400]) {
        await freeze(ms);
        frames.push(await sample());
      }
      await resume();
      await page.waitForFunction((selector) => document.querySelector(selector).dataset.morphState === "open", sheet);
      const to = await sample();
      near(frames.at(-1), to, `${label} last frame`);
      for (const frame of frames) {
        for (const key of ["x", "y", "width", "height"]) {
          assert.ok(frame[key] >= Math.min(from[key], to[key]) - 1 && frame[key] <= Math.max(from[key], to[key]) + 1,
            `${label}: glyph overshoots ${key}: ${JSON.stringify({ from, frame, to })}`);
        }
      }

      await start(`${sheet} .mcs-back`);
      near(await sample(), to, `${label} Back first frame`);
      await freeze(300);
      near(await sample(), from, `${label} Back landing`);
      await resume();
      await closed();

      // Back before opening finishes must reverse from the same visual frame.
      await start(`${card} .mcs-hit`);
      await freeze(120);
      const interrupted = await sample();
      const afterBack = await page.evaluate(({ sheet, glyph }) => {
        document.querySelector(`${sheet} .mcs-back`).click();
        const b = document.querySelector(glyph).getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      }, { sheet, glyph });
      near(afterBack, interrupted, `${label} interrupted Back`);
      await closed();
      assert.equal(await page.locator("[data-morph-ghost]").count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS ${label}: open, Back, interrupted Back`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
