// Browser tests for the useMorph hook, on tests/fixtures/react (StrictMode,
// React development build). Run in the desktop and phone projects.
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers";

declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: set by the fixture
    reactMorph: any;
    // biome-ignore lint/suspicious/noExplicitAny: set by the fixture
    fixture: any;
    unmountApp: () => void;
    listenerCount: () => Record<string, number>;
    // biome-ignore lint/suspicious/noExplicitAny: samples taken by a test
    samples: any[];
  }
}

type Rect = { left: number; top: number; width: number; height: number };

/** Runs before the page's scripts: keeps a list of live event listeners. */
function trackListeners() {
  const live: { target: EventTarget; type: string; listener: unknown; capture: boolean }[] = [];
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  const capture = (o: unknown) => (typeof o === "boolean" ? o : Boolean((o as { capture?: boolean } | undefined)?.capture));
  const find = (target: EventTarget, type: string, listener: unknown, o: unknown) =>
    live.findIndex((e) => e.target === target && e.type === type && e.listener === listener && e.capture === capture(o));
  EventTarget.prototype.addEventListener = function (this: EventTarget, type, listener, options) {
    if (listener && find(this, type, listener, options) < 0) live.push({ target: this, type, listener, capture: capture(options) });
    return add.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function (this: EventTarget, type, listener, options) {
    const i = find(this, type, listener, options);
    if (i >= 0) live.splice(i, 1);
    return remove.call(this, type, listener, options);
  };
  window.listenerCount = () => {
    const name = (t: EventTarget) =>
      t === document ? "document" : t instanceof Element && t.matches(".mc-sheet") ? "sheet" : t instanceof Element && t.matches(".mc-scrim") ? "scrim" : null;
    const out: Record<string, number> = { "document:keydown": 0, "sheet:click": 0, "scrim:click": 0 };
    for (const e of live) {
      const key = `${name(e.target)}:${e.type}`;
      if (key in out) out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  };
}

async function gotoReact(page: Page, mode?: "keyed") {
  await page.goto(`/tests/fixtures/react/index.html${mode ? `?mode=${mode}` : ""}`);
  await page.waitForFunction(() => "reactMorph" in window && window.reactMorph.instance !== null);
  await page.evaluate(() => document.fonts.ready);
}

/** The state React rendered is `target` and no transition is running. */
async function settled(page: Page, target: "open" | "closed") {
  await page.waitForFunction(
    (t) =>
      document.querySelector(".state")?.textContent === t &&
      document.getAnimations().every((a) => a instanceof CSSTransition || a.effect?.getComputedTiming().endTime === 0),
    target,
    { timeout: 20_000 },
  );
}

async function openCard(page: Page, id: string) {
  const hit = page.getByRole("button", { name: `Open delivery ${id}` });
  await hit.scrollIntoViewIfNeeded();
  await hit.click();
  await settled(page, "open");
}

/** What a transition could leave behind on the page. */
function leftovers(page: Page) {
  return page.evaluate(() => ({
    ghosts: document.querySelectorAll("[data-morph-ghost]").length,
    inert: document.querySelectorAll("[inert]").length,
    stateAttr: document.querySelectorAll("[data-morph-state]").length,
    animations: document.getAnimations().filter((a) => !(a instanceof CSSTransition)).length,
    screenStyle: document.querySelector(".mc-screen")?.getAttribute("style") ?? null,
  }));
}

const clean = { ghosts: 0, inert: 0, stateAttr: 0, animations: 0, screenStyle: null };

function expectNear(actual: Rect, expected: Rect, label: string) {
  for (const side of ["left", "top", "width", "height"] as const) {
    expect(Math.abs(actual[side] - expected[side]), `${label} ${side}: ${actual[side]} vs ${expected[side]}`).toBeLessThanOrEqual(1);
  }
}

test.describe("useMorph", () => {
  test("open then Back lands the card on its exact rect", async ({ page, errors }) => {
    await gotoReact(page);
    await openCard(page, "2042");

    // Click Back and freeze every animation on its last frame.
    const last = await page.evaluate(() => {
      (document.querySelector(".mc-back") as HTMLElement).click();
      for (const a of document.getAnimations()) {
        if (a instanceof CSSTransition) continue;
        a.pause();
        a.currentTime = Number(a.effect?.getComputedTiming().endTime ?? 0);
      }
      const rect = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { left: b.left, top: b.top, width: b.width, height: b.height };
      };
      const sheet = document.querySelector(".mc-sheet") as HTMLElement;
      const s = sheet.getBoundingClientRect();
      const values = (getComputedStyle(sheet).clipPath.match(/inset\(([^)]*?)(?: round|\))/)?.[1] ?? "0")
        .trim()
        .split(/\s+/)
        .map(Number.parseFloat);
      const top = values[0] ?? 0;
      const right = values[1] ?? top;
      const bottom = values[2] ?? top;
      const left = values[3] ?? right;
      const ghost = sheet.querySelector("[data-morph-ghost]");
      return {
        plan: window.reactMorph.instance.plan,
        ghost: ghost ? rect(ghost) : null,
        clip: { left: s.left + left, top: s.top + top, width: s.width - left - right, height: s.height - top - bottom },
        flights: [...sheet.querySelectorAll(".mc-head [data-morph]")].map((el) => ({ key: el.getAttribute("data-morph"), ...rect(el) })),
      };
    });
    expect(last.plan).toMatchObject({ direction: "close", choreography: "morph" });
    expect(last.ghost).not.toBeNull();
    expect(last.flights).toHaveLength(4);

    await page.evaluate(() => {
      for (const a of document.getAnimations()) if (a.playState === "paused") a.play();
    });
    await settled(page, "closed");
    const card = await page.evaluate(() => {
      const rect = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { left: b.left, top: b.top, width: b.width, height: b.height };
      };
      const el = document.querySelector('.mc-card[data-id="2042"]') as HTMLElement;
      return {
        rect: rect(el),
        parts: Object.fromEntries([...el.querySelectorAll("[data-morph]")].map((p) => [p.getAttribute("data-morph"), rect(p)])),
      };
    });
    expectNear(last.ghost as Rect, card.rect, "ghost");
    expectNear(last.clip, card.rect, "clip");
    // Every shared element ends on the card's own copy.
    for (const f of last.flights) {
      const part = card.parts[f.key as string] as Rect;
      expect(Math.abs(f.left - part.left), `${f.key} left`).toBeLessThanOrEqual(1);
      expect(Math.abs(f.top - part.top), `${f.key} top`).toBeLessThanOrEqual(1);
    }
    expect(await leftovers(page)).toEqual(clean);
    await expect(page.getByRole("button", { name: "Open delivery 2042" })).toBeFocused();
    void errors;
  });

  test("item stays set until the close has finished", async ({ page, errors }) => {
    await gotoReact(page, "keyed");
    expect(await page.evaluate(() => window.reactMorph.item)).toBeNull();
    await openCard(page, "2042");
    expect(await page.evaluate(() => window.reactMorph.item?.id)).toBe("2042");
    await expect(page.locator(".mc-sheet .mc-head")).toHaveAttribute("data-item", "2042");
    await expect(page.locator(".mc-sheet .cargo")).toHaveText("Chilled dairy, 22 pallets");

    // Sample every frame of the close: what React rendered and what is on screen.
    await page.evaluate(() => {
      window.samples = [];
      const sheet = document.querySelector(".mc-sheet") as HTMLElement;
      const tick = () => {
        window.samples.push({
          hidden: sheet.hidden,
          state: document.querySelector(".state")?.textContent,
          item: window.reactMorph.item?.id ?? null,
          head: sheet.querySelector(".mc-head")?.getAttribute("data-item") ?? null,
          ghost: sheet.querySelector("[data-morph-ghost]") !== null,
        });
        if (!(sheet.hidden && window.reactMorph.item === null)) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.getByRole("button", { name: "Back" }).click();
    await settled(page, "closed");
    await page.waitForFunction(() => window.reactMorph.item === null);
    const samples = await page.evaluate(() => window.samples);

    const shown = samples.filter((s) => !s.hidden);
    expect(shown.some((s) => s.ghost), "sampled mid-close").toBe(true);
    for (const s of shown) expect(s, "sheet visible").toMatchObject({ item: "2042", head: "2042" });
    for (const s of samples.filter((x) => x.item === null)) expect(s, "item cleared").toMatchObject({ hidden: true, state: "closed" });
    await expect(page.locator(".mc-sheet .mc-head")).toHaveCount(0);
    expect(await leftovers(page)).toEqual(clean);
    void errors;
  });

  test("StrictMode double mount leaves one engine and no leaked listeners or ghosts", async ({ page, errors }) => {
    await page.addInitScript(trackListeners);
    await gotoReact(page);
    const one = { "document:keydown": 1, "sheet:click": 1, "scrim:click": 1 };
    expect(await page.evaluate(() => window.listenerCount())).toEqual(one);

    for (const id of ["2042", "2043"]) {
      await openCard(page, id);
      await page.keyboard.press("Escape");
      await settled(page, "closed");
    }
    expect(await page.evaluate(() => window.listenerCount())).toEqual(one);
    expect(await leftovers(page)).toEqual(clean);

    await page.evaluate(() => window.unmountApp());
    await page.waitForSelector(".unmounted");
    expect(await page.evaluate(() => window.listenerCount())).toEqual({ "document:keydown": 0, "sheet:click": 0, "scrim:click": 0 });
    void errors;
  });

  test("unmounting the sheet mid-open restores the page", async ({ page, errors }) => {
    await page.addInitScript(trackListeners);
    await gotoReact(page);
    const during = await page.evaluate(() => {
      (document.querySelector('.mc-card[data-id="2042"] .mc-card-hit') as HTMLElement).click();
      const seen = {
        state: document.querySelector(".mc-sheet")?.getAttribute("data-morph-state"),
        ghosts: document.querySelectorAll("[data-morph-ghost]").length,
        inert: document.querySelector(".mc-screen")?.hasAttribute("inert"),
      };
      window.fixture.hideSheet();
      return seen;
    });
    expect(during).toEqual({ state: "opening", ghosts: 1, inert: true });
    await expect(page.locator(".mc-sheet")).toHaveCount(0);
    await expect(page.locator(".state")).toHaveText("closed");
    expect(await leftovers(page)).toEqual(clean);
    expect(await page.evaluate(() => window.listenerCount())).toEqual({ "document:keydown": 0, "sheet:click": 0, "scrim:click": 0 });
    // The list works again.
    await expect(page.getByRole("button", { name: "Open delivery 2043" })).toBeEnabled();
    await page.getByRole("button", { name: "Open delivery 2043" }).click();
    await expect(page.locator(".state")).toHaveText("closed");
    void errors;
  });

  test("unmounting the component mid-close cleans up", async ({ page, errors }) => {
    await page.addInitScript(trackListeners);
    await gotoReact(page);
    await openCard(page, "2042");
    const during = await page.evaluate(() => {
      (document.querySelector(".mc-back") as HTMLElement).click();
      const ghosts = document.querySelectorAll("[data-morph-ghost]").length;
      window.unmountApp();
      return ghosts;
    });
    expect(during).toBe(1);
    await page.waitForSelector(".unmounted");
    expect(await leftovers(page)).toEqual(clean);
    expect(await page.evaluate(() => window.listenerCount())).toEqual({ "document:keydown": 0, "sheet:click": 0, "scrim:click": 0 });
    // Nothing left to react to Escape, and nothing throws.
    await page.keyboard.press("Escape");
    void errors;
  });

  test("changing options live applies to the next run", async ({ page, errors }) => {
    await gotoReact(page);
    /** Clicks, then reads the sheet's clip-path duration of the run that started. */
    const clipDuration = (selector: string) =>
      page.evaluate((sel) => {
        (document.querySelector(sel) as HTMLElement).click();
        const sheet = document.querySelector(".mc-sheet");
        const clip = document
          .getAnimations()
          .find((a) => (a.effect as KeyframeEffect).target === sheet && (a.effect as KeyframeEffect).getKeyframes().some((k) => "clipPath" in k));
        return Number(clip?.effect?.getTiming().duration);
      }, selector);
    const setOptions = async (options: object) => {
      await page.evaluate((o) => window.fixture.setOptions(o), options);
      await page.waitForFunction((json) => document.querySelector(".mc-demo")?.getAttribute("data-options") === json, JSON.stringify(options));
    };
    const cycle = async () => {
      const open = await clipDuration('.mc-card[data-id="2042"] .mc-card-hit');
      await settled(page, "open");
      const close = await clipDuration(".mc-back");
      await settled(page, "closed");
      return { open, close };
    };

    expect(await cycle()).toEqual({ open: 400, close: 300 });
    await setOptions({ duration: { open: 600, close: 500 } });
    expect(await cycle()).toEqual({ open: 600, close: 500 });
    // Dropping `duration` brings back the defaults; timeScale multiplies them.
    await setOptions({ timeScale: 2 });
    expect(await cycle()).toEqual({ open: 800, close: 600 });
    await setOptions({});
    expect(await cycle()).toEqual({ open: 400, close: 300 });
    expect(await leftovers(page)).toEqual(clean);
    void errors;
  });

  test("keyed open, and close to a card the list re-rendered", async ({ page, errors }) => {
    await gotoReact(page, "keyed");
    // Open by key and item: no element passed.
    await page.evaluate(() => {
      const d = window.fixture.deliveries.find((x: { id: string }) => x.id === "2043");
      void window.reactMorph.open({ key: "2043", item: d });
    });
    await settled(page, "open");
    const opened = await page.evaluate(() => ({
      card: window.reactMorph.instance.card?.getAttribute("data-id"),
      plan: window.reactMorph.instance.plan,
      item: window.reactMorph.item?.id,
    }));
    expect(opened.card).toBe("2043");
    expect(opened.item).toBe("2043");
    expect(opened.plan.choreography).toBe("morph");
    for (const p of opened.plan.pairs) expect(p.mode, p.key).not.toBe("skip");

    // The list re-renders while the sheet is open: every card is a new element.
    await page.evaluate(() => window.fixture.remountList());
    await expect(page.locator('.mc-card[data-id="2043"]')).toHaveAttribute("data-generation", "1");
    await page.getByRole("button", { name: "Back" }).click();
    await settled(page, "closed");
    const closed = await page.evaluate(() => ({
      plan: window.reactMorph.instance.plan,
      focused: document.activeElement?.closest(".mc-card")?.getAttribute("data-generation"),
    }));
    // Back flew to the new element, not to the detached one.
    expect(closed.plan).toMatchObject({ direction: "close", choreography: "morph" });
    expect(closed.focused).toBe("1");
    await expect(page.getByRole("button", { name: "Open delivery 2043" })).toBeFocused();

    // close({ to: key }) returns to another registered card.
    await openCard(page, "2042");
    await page.evaluate(() => void window.reactMorph.close({ to: "2041" }));
    await settled(page, "closed");
    expect(await page.evaluate(() => window.reactMorph.instance.plan.choreography)).toBe("morph");
    await expect(page.getByRole("button", { name: "Open delivery 2041" })).toBeFocused();
    expect(await leftovers(page)).toEqual(clean);
    void errors;
  });

  test("open(key, update) works with the element-free form in the classic flow", async ({ page, errors }) => {
    await gotoReact(page);
    await page.evaluate(() => {
      const d = window.fixture.deliveries.find((x: { id: string }) => x.id === "2041");
      void window.reactMorph.open("2041", () => window.fixture.show(d));
    });
    await settled(page, "open");
    const plan = await page.evaluate(() => window.reactMorph.instance.plan);
    expect(plan.choreography).toBe("morph");
    for (const p of plan.pairs) expect(p.mode, p.key).not.toBe("skip");
    await expect(page.locator(".mc-sheet .mc-head")).toHaveAttribute("data-item", "2041");
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    expect(await leftovers(page)).toEqual(clean);
    void errors;
  });
});
