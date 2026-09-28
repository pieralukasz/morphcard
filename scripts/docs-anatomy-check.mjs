// Build docs-site and serve out/, then run BASE=http://127.0.0.1:3346 node scripts/docs-anatomy-check.mjs
import assert from "node:assert/strict";
import { chromium, firefox, webkit } from "@playwright/test";

const browser = await ({ chromium, firefox, webkit }[process.env.BROWSER ?? "chromium"]).launch();
const base = process.env.BASE ?? "http://127.0.0.1:3346";
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "no-preference" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/docs/anatomy`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-live-demo][data-ready]");
    await page.locator(".mct-play").click();
    assert.ok(await page.evaluate(() => document.getAnimations().some((a) => a.effect.getKeyframes().some((f) => f.clipPath))), "Play must start a morph, not an offscreen fade");
    await page.waitForFunction(() => document.querySelector(".mct-time").textContent.replace(/\s/g, "") === "525/525ms");
    await page.waitForFunction(() => document.querySelector(".mct .mc-sheet").dataset.morphState === "open");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "timeline must not overflow sideways");

    await page.locator(".mct-top button", { hasText: "Close" }).click();
    await page.locator(".mct-play").click();
    await page.waitForFunction(() => document.querySelector(".mct-time").textContent.replace(/\s/g, "") === "300/300ms");
    await page.waitForFunction(() => document.querySelector(".mct .mc-sheet").hidden);

    await page.locator(".mct-top button", { hasText: "Open" }).click();
    const slider = page.locator('.mct input[type="range"]');
    await slider.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector(".mct-time").textContent.trim().startsWith("1 "));
    assert.ok(await page.evaluate(() => {
      const anims = document.getAnimations().filter((a) => !(a instanceof CSSTransition));
      return anims.length > 0 && anims.every((a) => a.playState === "paused" && a.currentTime === 1);
    }), "scrubbing must seek every real animation");
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: visible morph, first Play 525 ms, Back 300 ms, scrub, no overflow`);
    await page.close();
  }
} finally {
  await browser.close();
}
