// Every element of the docs site that grows into a sheet must come back to
// where it started. For each kind of morph, at a desktop and a phone size:
//   - the trigger does not move while the page animates (layout box, every frame),
//   - the page never scrolls sideways,
//   - at the last frame of Back the card copy sits on the trigger (±1 px),
//   - the page scroll is where it was, and focus is back on the trigger,
//   - Escape closes (and on desktop a click on the scrim does too),
//   - no [data-morph-ghost] is left, and the console stays clean.
//   BASE=http://127.0.0.1:3341 node scripts/docs-morph-check.mjs
//   RESOLVE=host:ip pins a hostname the local resolver does not know yet.
import { chromium } from "@playwright/test";

const base = process.env.BASE ?? "http://127.0.0.1:3341";
const resolve = process.env.RESOLVE?.split(":");
const browser = await chromium.launch({
  args: resolve ? [`--host-resolver-rules=MAP ${resolve[0]} ${resolve[1]}`] : [],
});

const STAGE = { sheet: "body > .mcs-sheet", back: "body > .mcs-sheet .mcs-back", scrim: "body > .mcs-scrim", hit: ".mcs-hit" };
const cases = [
  { kind: "hero card", path: "/", trigger: '.mch-card[data-id="kyoto"]', ...STAGE },
  { kind: "feature tile", path: "/", trigger: ".mcs-grid.is-features > .mcs-tile:nth-child(2)", ...STAGE },
  { kind: "video tile", path: "/", trigger: ".mcs-video-tile", ...STAGE },
  { kind: "code card", path: "/", trigger: ".mcs-code-card", ...STAGE },
  { kind: "topic card", path: "/docs", trigger: ".mcs-grid.is-topics > .mcs-tile:nth-child(4)", ...STAGE },
  { kind: "playground tile", path: "/docs/playground", trigger: ".mcp-stage .mcs-tile:nth-child(1)", ...STAGE },
  {
    kind: "phone demo",
    path: "/",
    trigger: '[data-live-demo] .mc-card[data-id="2042"]',
    sheet: "[data-live-demo] .mc-sheet",
    back: "[data-live-demo] .mc-sheet .mc-back",
    scrim: null,
    hit: ".mc-card-hit",
    ready: "[data-live-demo][data-ready]",
  },
];

const failures = [];
const report = [];

for (const [label, width, height] of [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
]) {
  for (const c of cases) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const fail = (msg) => failures.push(`${label} ${c.kind}: ${msg}`);
    await page.goto(base + c.path, { waitUntil: "networkidle" });
    await page.waitForSelector(c.ready ?? STAGE.sheet, { state: "attached", timeout: 30000 });
    await page.locator(c.trigger).first().scrollIntoViewIfNeeded();
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center", behavior: "instant" }), c.trigger);
    await page.waitForTimeout(100);

    const result = await page.evaluate(async (c) => {
      const trigger = document.querySelector(c.trigger);
      const sheet = () => document.querySelector(c.sheet);
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      const idle = () =>
        !document.getAnimations().some((a) => a.playState === "running" && a.effect?.getComputedTiming().endTime > 0);
      const until = (fn, ms = 15000) =>
        new Promise((done, reject) => {
          const t0 = performance.now();
          const check = () => {
            if (fn() && idle()) done();
            else if (performance.now() - t0 > ms) reject(new Error(`timeout: ${fn}`));
            else setTimeout(check, 16);
          };
          check();
        });
      const isOpen = () => sheet()?.getAttribute("data-morph-state") === "open";
      const isClosed = () => sheet()?.hidden === true;
      // The trigger's layout box, ignoring transforms (the page behind scales on purpose).
      const layoutBox = () => {
        let x = 0;
        let y = 0;
        for (let n = trigger; n; n = n.offsetParent) {
          x += n.offsetLeft - (n.scrollLeft || 0);
          y += n.offsetTop - (n.scrollTop || 0);
        }
        return `${x},${y - scrollY},${trigger.offsetWidth}x${trigger.offsetHeight}`;
      };
      const rest = () => {
        const r = trigger.getBoundingClientRect();
        return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10);
      };
      const boxes = new Set();
      let overflow = 0;
      let sampling = true;
      const tick = () => {
        boxes.add(layoutBox());
        overflow = Math.max(overflow, document.documentElement.scrollWidth - innerWidth);
        if (sampling) requestAnimationFrame(tick);
      };

      const before = { rect: rest(), scroll: scrollY };
      tick();
      trigger.querySelector(c.hit).click();
      await until(isOpen);
      const focusIn = sheet().contains(document.activeElement);
      const plan = sheet().getAttribute("data-morph-state");

      // Back, frozen at its last frame: where is the card copy?
      document.querySelector(c.back).click();
      await frame();
      await frame();
      const anims = document.getAnimations().filter((a) => a.effect?.getComputedTiming().endTime > 0);
      const end = Math.max(...anims.map((a) => a.effect.getComputedTiming().endTime));
      for (const a of anims) {
        a.pause();
        a.currentTime = end - 1;
      }
      const g = sheet().querySelector("[data-morph-ghost]")?.getBoundingClientRect();
      const ghost = g ? [g.left, g.top, g.width, g.height].map((v) => Math.round(v * 10) / 10) : null;
      for (const a of anims) a.play();
      await until(isClosed);
      const afterBack = {
        rect: rest(),
        scroll: scrollY,
        focus: trigger.contains(document.activeElement),
        active: document.activeElement?.className || document.activeElement?.tagName,
      };

      // Escape.
      trigger.querySelector(c.hit).click();
      await until(isOpen);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      let escaped = true;
      try {
        await until(isClosed, 5000);
      } catch {
        escaped = false;
      }
      const escFocus = trigger.contains(document.activeElement);

      // Scrim, where it is visible (the desktop panel).
      let scrim = null;
      if (c.scrim && innerWidth > 640) {
        trigger.querySelector(c.hit).click();
        await until(isOpen);
        document.elementFromPoint(8, innerHeight - 8)?.click();
        try {
          await until(isClosed, 5000);
          scrim = true;
        } catch {
          scrim = false;
        }
      }
      sampling = false;
      await frame();
      return {
        before,
        afterBack,
        ghost,
        focusIn,
        plan,
        escaped,
        escFocus,
        scrim,
        boxes: [...boxes],
        overflow,
        leftovers: document.querySelectorAll("[data-morph-ghost]").length,
        state: sheet().getAttribute("data-morph-state"),
      };
    }, c);

    const r = result;
    report.push({ viewport: label, kind: c.kind, rect: r.before.rect, ghost: r.ghost, boxes: r.boxes.length, scroll: [r.before.scroll, r.afterBack.scroll] });
    if (r.boxes.length !== 1) fail(`trigger moved: ${r.boxes.join(" | ")}`);
    if (r.before.rect.join() !== r.afterBack.rect.join()) fail(`trigger rect ${r.before.rect} became ${r.afterBack.rect}`);
    if (r.overflow > 0) fail(`page overflows sideways by ${r.overflow}px`);
    if (!r.ghost) fail("no card copy at the last frame of Back");
    else if (r.ghost.some((v, i) => Math.abs(v - r.afterBack.rect[i]) > 1)) fail(`Back lands at ${r.ghost}, the trigger is at ${r.afterBack.rect}`);
    if (Math.abs(r.before.scroll - r.afterBack.scroll) > 0.5) fail(`scroll ${r.before.scroll} became ${r.afterBack.scroll}`);
    if (!r.focusIn) fail("focus did not move into the sheet");
    if (!r.afterBack.focus) fail(`focus is on ${r.afterBack.active}, not the trigger`);
    if (!r.escaped) fail("Escape did not close");
    if (!r.escFocus) fail("focus not on the trigger after Escape");
    if (r.scrim === false) fail("a click on the scrim did not close");
    if (r.leftovers) fail(`${r.leftovers} [data-morph-ghost] left`);
    if (errors.length) fail(`console: ${errors.join(" | ")}`);
    await page.close();
  }
}

await browser.close();
console.log(JSON.stringify({ report, failures }, null, 2));
if (failures.length) process.exit(1);
