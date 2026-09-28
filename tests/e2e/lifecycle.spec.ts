import { expect, gotoDemo, pauseAt, settled, test } from "./helpers";

test("Escape dismisses the latest sheet and ignores lower sheets during its close", async ({ page, errors }) => {
  await gotoDemo(page);
  const result = await page.evaluate(async () => {
    const path = "/examples/dist/engine.js";
    const { createMorph } = await import(path);
    await window.demo.open("2042");
    const sheet = document.createElement("section");
    sheet.style.cssText = "position:fixed;inset:20px;background:white";
    sheet.innerHTML = "<button data-morph-close>Close top panel</button>";
    document.body.append(sheet);
    const top = createMorph({ sheet });
    await top.open(null);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    const first = [window.morph.state, top.state];
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    const repeated = window.morph.state;
    await top.close();
    top.destroy();
    sheet.remove();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    await window.morph.close();
    return { first, repeated, last: window.morph.state };
  });
  expect(result).toEqual({ first: ["open", "closing"], repeated: "open", last: "closed" });
  void errors;
});

test("open and close in the same task resolve both promises", async ({ page, errors }) => {
  await gotoDemo(page);
  const result = await page.evaluate(async () => {
    const opening = window.demo.open("2042");
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = 0;
    }
    const closing = window.morph.close();
    return Promise.race([
      Promise.all([opening, closing]),
      new Promise((resolve) => setTimeout(() => resolve("unresolved"), 500)),
    ]);
  });
  expect(result).toEqual([false, true]);
  await settled(page, "closed");
  void errors;
});

test("zero-duration Back can reverse an opening run", async ({ page, errors }) => {
  await gotoDemo(page);
  await page.evaluate(() => {
    window.morph.setOptions({ duration: { close: 0 } });
    void window.demo.open("2042");
  });
  await pauseAt(page, 120);
  expect(await page.evaluate(() => window.morph.close())).toBe(true);
  await settled(page, "closed");
  void errors;
});

test("timing changes during a run do not snap the background at its end", async ({ page, errors }) => {
  await gotoDemo(page);
  await page.evaluate(() => void window.demo.open("2042"));
  await pauseAt(page, 150);
  await page.evaluate(() => {
    window.morph.setOptions({ backgroundScale: 0.8 });
    for (const a of document.getAnimations()) a.finish();
  });
  await settled(page, "open");
  const scale = () => page.evaluate(() => new DOMMatrix(getComputedStyle(window.demo.screen).transform).a);
  expect(await scale()).toBeCloseTo(0.96, 3);
  await page.evaluate(() => {
    void window.morph.close();
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = 0;
    }
  });
  expect(await scale()).toBeCloseTo(0.96, 3);
  await page.evaluate(() => {
    for (const a of document.getAnimations()) a.finish();
  });
  await settled(page, "closed");
  void errors;
});

test("batched animations keep fixed descendants in content and dock stationary", async ({ page, errors }) => {
  await gotoDemo(page);
  await page.evaluate(() => window.demo.open("2042"));
  await page.evaluate(() => window.morph.close());
  await page.evaluate(() => {
    // Preserve this rendered detail on subsequent opens.
    window.morph.setOptions({ prepare: undefined });
    for (const [i, selector] of [".mc-block", ".mc-actions"].entries()) {
      const fixed = document.createElement("span");
      fixed.className = `fixed-probe-${i}`;
      fixed.textContent = "Fixed";
      fixed.style.cssText = `position:fixed;left:8px;top:${20 + i * 30}px`;
      window.demo.sheet.querySelector(selector).append(fixed);
    }
    void window.demo.open("2042");
  });
  const check = async () => {
    await pauseAt(page, 150);
    const tops = await page.evaluate(() =>
      [0, 1].map((i) => document.querySelector(`.fixed-probe-${i}`)!.getBoundingClientRect().top),
    );
    expect(tops).toEqual([20, 50]);
    await page.evaluate(() => {
      for (const a of document.getAnimations()) a.finish();
    });
  };
  await check();
  await settled(page, "open");
  await page.evaluate(() => void window.morph.close());
  await check();
  await settled(page, "closed");
  void errors;
});

for (const options of [
  { timeScale: 0 },
  { duration: { open: 0, close: 0 }, stagger: 0 },
  { reducedMotion: true },
  { shared: [], backgroundScale: false },
]) {
  test(`finishes and cleans up with ${JSON.stringify(options)}`, async ({ page, errors }) => {
    await gotoDemo(page);
    await page.evaluate((options) => {
      window.morph.setOptions(options);
      void window.demo.open("2042");
    }, options);
    await settled(page, "open");
    expect(await page.evaluate(() => window.morph.close())).toBe(true);
    await settled(page, "closed");
    expect(await page.locator("[data-morph-ghost], [inert], [data-morph-state]").count()).toBe(0);
    void errors;
  });
}

for (const easing of ["surface", "content"] as const) {
  test(`an invalid ${easing} animation restores the page and permits another open`, async ({ page, errors }) => {
    await gotoDemo(page);
    const failed = await page.evaluate((easing) => {
      window.morph.setOptions({ easing: { [easing]: "invalid-easing" } });
      try {
        void window.demo.open("2042");
        return false;
      } catch {
        return true;
      }
    }, easing);
    expect(failed).toBe(true);
    expect(await page.evaluate(() => window.morph.state)).toBe("closed");
    expect(await page.locator("[data-morph-ghost], [inert]").count()).toBe(0);
    await page.evaluate(() => {
      window.morph.setOptions({ easing: { surface: "linear", content: "linear" } });
      void window.demo.open("2042");
    });
    await settled(page, "open");
    await page.evaluate(() => void window.morph.close());
    await settled(page, "closed");
    void errors;
  });
}
