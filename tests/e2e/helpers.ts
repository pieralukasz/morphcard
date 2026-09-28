import { type Page, expect, test as base } from "@playwright/test";

declare global {
  interface Window {
    // Set by examples/index.html.
    // biome-ignore lint/suspicious/noExplicitAny: test hook
    demo: any;
    // biome-ignore lint/suspicious/noExplicitAny: test hook
    morph: any;
    errors: string[];
    // biome-ignore lint/suspicious/noExplicitAny: recorded by recordAnimations()
    recorded: any[];
    ghostsSeen: number;
  }
}

/** Collects console errors and page errors; every test asserts there are none. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`);
    });
    await use(errors);
    expect(errors, "console errors or warnings").toEqual([]);
  },
});

export { expect };

export async function gotoDemo(page: Page, query = "") {
  await page.goto(`/examples/index.html?${query}`);
  await page.waitForSelector("html[data-ready]", { state: "attached" });
  await page.evaluate(() => document.fonts.ready);
}

export function state(page: Page) {
  return page.evaluate(() => window.morph.state as string);
}

/** Waits until the morph reaches `target` and no transition is running. */
export async function settled(page: Page, target: "open" | "closed") {
  await page.waitForFunction(
    (t) =>
      window.morph.state === t &&
      document.getAnimations().every((a) => a instanceof CSSTransition || a.effect?.getComputedTiming().endTime === 0),
    target,
    { timeout: 20_000 },
  );
}

/**
 * Every attribute the library could leave behind, for every element on the
 * page: inline styles, inert, hidden, tabindex, aria-hidden, plus ghosts.
 * The contents the demo writes into the sheet for each delivery (slots and
 * the heading's inner markup) are left out: they change by design.
 */
export function domSignature(page: Page) {
  return page.evaluate(() => {
    const rows: string[] = [];
    const filled = '[data-slot] *, .mc-head [data-morph] *';
    const all = [...document.body.querySelectorAll("*")].filter((el) => !el.matches(filled));
    all.forEach((el, i) => {
      const bits = ["style", "inert", "hidden", "tabindex", "aria-hidden", "data-morph-state"]
        .filter((name) => el.hasAttribute(name))
        .map((name) => `${name}=${el.getAttribute(name)}`);
      if (bits.length) rows.push(`${i}:${el.tagName.toLowerCase()}.${el.getAttribute("class") ?? ""}:${bits.join(",")}`);
    });
    return {
      count: all.length,
      ghosts: document.querySelectorAll("[data-morph-ghost]").length,
      animations: document.getAnimations().filter((a) => !(a instanceof CSSTransition)).length,
      rows,
    };
  });
}

/**
 * Wraps Element.prototype.animate so the test can inspect every animation the
 * library creates: which element, which properties, timing.
 */
export async function recordAnimations(page: Page) {
  await page.evaluate(() => {
    window.recorded = [];
    window.ghostsSeen = 0;
    const original = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, frames, options) {
      const list = Array.isArray(frames) ? frames : [];
      const props = new Set<string>();
      for (const f of list) for (const key of Object.keys(f)) if (!["offset", "easing", "composite"].includes(key)) props.add(key);
      const opts = typeof options === "number" ? { duration: options } : (options ?? {});
      const el = this as HTMLElement;
      window.recorded.push({
        target:
          el === window.demo.sheet
            ? "sheet"
            : el === window.demo.screen
              ? "background"
              : el === window.demo.scrim
                ? "scrim"
                : el.getAttribute("data-morph")
                  ? `shared:${el.getAttribute("data-morph")}`
                  : el.getAttribute("class") || el.tagName.toLowerCase(),
        inGhost: Boolean(el.closest("[data-morph-ghost]")),
        inSheet: window.demo.sheet.contains(el) && !el.closest("[data-morph-ghost]"),
        props: [...props],
        frames: list,
        duration: Number(opts.duration ?? 0),
        delay: Number(opts.delay ?? 0),
      });
      return original.call(this, frames, options);
    };
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n instanceof Element && n.hasAttribute("data-morph-ghost")) window.ghostsSeen++;
    }).observe(document.body, { childList: true, subtree: true });
  });
}

// biome-ignore lint/suspicious/noExplicitAny: recorded entries
export function recorded(page: Page): Promise<any[]> {
  return page.evaluate(() => window.recorded.splice(0));
}

/** Pauses every running animation at `ms` from its start. */
export function pauseAt(page: Page, ms: number) {
  return page.evaluate((t) => {
    for (const a of document.getAnimations()) {
      if (a instanceof CSSTransition) continue;
      a.pause();
      a.currentTime = t;
    }
  }, ms);
}

export function resume(page: Page) {
  return page.evaluate(() => {
    for (const a of document.getAnimations()) if (a.playState === "paused") a.play();
  });
}

/** Clicks a card the way a user does (its full-size hit button). */
export async function clickCard(page: Page, id: string) {
  const hit = page.locator(`.mc-card[data-id="${id}"] .mc-card-hit`);
  await hit.scrollIntoViewIfNeeded();
  await hit.click();
}
