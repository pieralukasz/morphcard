// Records a transition frame by frame. Every animation (Web Animations and
// CSS) is paused and stepped 1/60 s at a time, so the result is smooth even
// in a slow headless browser.
//
// The page must expose window.demo.open(id), window.demo.close() and
// window.morph.state (examples/index.html does).
//
//   URL="http://127.0.0.1:3301/examples/index.html?layout=frame" \
//   OUT=recordings TAG=phone-light ID=2042 node scripts/record.mjs
//
// Env: W, H, DPR (default 390x800 @2), ID, TAG, INTERRUPT (ms into the open
// at which close() is called), SCROLL (list scrollTop before opening),
// HOLD_LIST, HOLD_OPEN, HOLD_END (frames to hold on each state).
// Frames: $OUT/$TAG/f0000.png ...
import { mkdirSync, rmSync } from "node:fs";
import { chromium } from "@playwright/test";

const URL_ = process.env.URL ?? "http://127.0.0.1:3301/examples/index.html?layout=frame";
const OUT = process.env.OUT ?? "recordings";
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 800);
const DPR = Number(process.env.DPR ?? 2);
const ID = process.env.ID ?? "2042";
const TAG = process.env.TAG ?? `${W}-${ID}`;
const INTERRUPT = process.env.INTERRUPT ? Number(process.env.INTERRUPT) : null;
const SCROLL = process.env.SCROLL ? Number(process.env.SCROLL) : 0;
const HOLD_LIST = Number(process.env.HOLD_LIST ?? 18);
const HOLD_OPEN = Number(process.env.HOLD_OPEN ?? 40);
const HOLD_END = Number(process.env.HOLD_END ?? 24);
const STEP = 1000 / 60;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL_);
await page.waitForSelector("html[data-ready]", { state: "attached" });
await page.evaluate(() => document.fonts.ready);
if (SCROLL) {
  await page.evaluate((y) => {
    const s = window.demo.screen;
    if (s.scrollHeight > s.clientHeight && getComputedStyle(s).overflowY !== "visible") s.scrollTop = y;
    else window.scrollTo(0, y);
  }, SCROLL);
}
await page.waitForTimeout(300);

const dir = `${OUT}/${TAG}`;
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
let n = 0;
const shot = () => page.screenshot({ path: `${dir}/f${String(n++).padStart(4, "0")}.png` });
const hold = async (frames) => {
  // Identical frames: copy the last file instead of taking new screenshots.
  for (let i = 0; i < frames; i++) await shot();
};

// Advances every paused animation by dt (respecting its playback rate).
// Returns true when all of them have reached their end.
const advance = (dt) =>
  page.evaluate((dt) => {
    let done = true;
    for (const a of document.getAnimations()) {
      if (a.playState === "running" || a.pending) a.pause();
      const end = a.effect.getComputedTiming().endTime;
      const rate = a.playbackRate;
      const t = Number(a.currentTime ?? 0);
      const next = Math.min(end, Math.max(0, t + dt * rate));
      a.currentTime = next;
      if (rate > 0 ? next < end : next > 0) done = false;
    }
    return done;
  }, dt);

const finish = async (target) => {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      if (a.effect.getComputedTiming().endTime > 0) a.finish();
    }
  });
  await page.waitForFunction((t) => window.morph.state === t, target, { timeout: 10000 });
};

// Steps until every animation has ended, taking one frame per step.
async function stepAll(limitMs = 4000) {
  for (let t = 0; t <= limitMs; t += STEP) {
    await shot();
    if (await advance(STEP)) break;
  }
}

await hold(HOLD_LIST);
if (process.env.TRACE) {
  await page.evaluate(() => {
    window.mut = [];
    new MutationObserver((list) => {
      for (const m of list) window.mut.push([window.morph.state, m.oldValue, m.target.getAttribute("style")]);
    }).observe(window.demo.sheet, { attributes: true, attributeOldValue: true, attributeFilter: ["style"] });
  });
}
// Open and pause in the same task, so no real time passes.
await page.evaluate((id) => {
  window.demo.open(id);
  for (const a of document.getAnimations()) a.pause();
}, ID);
const plan = await page.evaluate(() => window.morph.plan);

let interrupted = false;
if (INTERRUPT !== null) {
  for (let t = 0; t < INTERRUPT; t += STEP) {
    await shot();
    await advance(STEP);
  }
  await page.evaluate(() => {
    window.demo.close();
    for (const a of document.getAnimations()) a.pause();
  });
  interrupted = true;
  await stepAll();
  await finish("closed");
} else {
  await stepAll();
  await finish("open");
  await hold(HOLD_OPEN);
  await page.evaluate(() => {
    window.demo.close();
    for (const a of document.getAnimations()) a.pause();
  });
  await stepAll();
  await finish("closed");
}
await page.waitForTimeout(50);
await hold(HOLD_END);
const leftovers = await page.evaluate(() => ({
  ghosts: document.querySelectorAll("[data-morph-ghost]").length,
  animations: document.getAnimations().filter((a) => !(a instanceof CSSTransition)).length,
  sheetStyle: window.demo.sheet.getAttribute("style"),
  state: window.morph.state,
}));
if (process.env.TRACE) leftovers.trace = await page.evaluate(() => window.mut);
console.log(JSON.stringify({ TAG, frames: n, interrupted, plan, leftovers, errors }));
await browser.close();
