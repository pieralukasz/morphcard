import { expect, pauseAt, resume, test } from "./helpers";

test.describe("React binding", () => {
  test("useMorph opens with the item rendered before measuring, and closes cleanly", async ({ page, errors }) => {
    await page.goto("/tests/fixtures/react/index.html");
    await page.waitForFunction(() => "reactMorph" in window);
    const before = await page.evaluate(() => ({
      styles: [...document.querySelectorAll("[style]")].length,
      inert: [...document.querySelectorAll("[inert]")].length,
    }));
    await page.getByRole("button", { name: "Open delivery 2042" }).click();
    await page.waitForFunction(() => document.querySelector(".state")?.textContent === "open");
    // flushSync rendered the heading before the flight was planned.
    const plan = await page.evaluate(() => (window as unknown as { reactMorph: { instance: { plan: unknown } } }).reactMorph.instance.plan);
    expect(plan).toMatchObject({ choreography: "morph" });
    expect((plan as { pairs: { mode: string }[] }).pairs.every((p) => p.mode !== "skip")).toBe(true);
    await expect(page.locator(".mc-sheet .mc-head .mc-route")).toContainText("Lyon");
    await expect(page.locator(".mc-sheet .cargo")).toHaveText("Chilled dairy, 22 pallets");
    await expect(page.getByRole("button", { name: "Back" })).toBeFocused();

    // A re-render while open must not reset the morph.
    await page.evaluate(() => (window as unknown as { bump: () => void }).bump());
    await expect(page.locator(".state")).toHaveText("open");

    await page.getByRole("button", { name: "Back" }).click();
    await page.waitForFunction(() => document.querySelector(".state")?.textContent === "closed");
    await expect(page.getByRole("button", { name: "Open delivery 2042" })).toBeFocused();
    const after = await page.evaluate(() => ({
      styles: [...document.querySelectorAll("[style]")].length,
      inert: [...document.querySelectorAll("[inert]")].length,
    }));
    expect(after).toEqual(before);
    expect(await page.locator("[data-morph-ghost]").count()).toBe(0);
    void errors;
  });
});

test.describe("images", () => {
  test("an image flies by width and a caption that fits scales", async ({ page, errors }) => {
    await page.goto("/tests/fixtures/gallery.html");
    await page.waitForSelector("html[data-ready]", { state: "attached" });
    const styledBefore = await page.evaluate(() => [...document.querySelectorAll("[style]")].map((el) => el.outerHTML.slice(0, 60)));
    await page.locator(".tile").nth(1).click();
    await page.waitForFunction(() => window.morph.state === "open");
    const plan = await page.evaluate(() => window.morph.plan);
    expect(plan.choreography).toBe("morph");
    const photo = plan.pairs.find((p: { key: string }) => p.key === "photo");
    expect(photo.mode).toBe("scale");
    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForFunction(() => window.morph.state === "closed");
    const sig = await page.evaluate(() => ({
      ghosts: document.querySelectorAll("[data-morph-ghost]").length,
      styled: [...document.querySelectorAll("[style]")].map((el) => el.outerHTML.slice(0, 60)),
    }));
    expect(sig).toEqual({ ghosts: 0, styled: styledBefore });
    void errors;
  });

  test("a photo that changes shape stays one picture: same centre, the card copy inside the frame", async ({ page, errors }) => {
    await page.goto("/tests/fixtures/gallery.html?wide");
    await page.waitForSelector("html[data-ready]", { state: "attached" });
    // Where each copy is visible (its box cut by its clip-path) and where the
    // centre of its photo is. Both images are object-fit: cover, centred.
    const sample = () =>
      page.evaluate(() => {
        const read = (el: HTMLElement) => {
          const r = el.getBoundingClientRect();
          const k = r.width / el.offsetWidth;
          const m = /inset\(([^)]*)\)/.exec(getComputedStyle(el).clipPath);
          const v = (m?.[1] ?? "0px").split(" round ")[0]?.trim().split(/\s+/).map(Number.parseFloat) ?? [0];
          const t = v[0] ?? 0;
          const rt = v[1] ?? t;
          const b = v[2] ?? t;
          const l = v[3] ?? rt;
          return {
            shown: [r.left + l * k, r.top + t * k, r.right - rt * k, r.bottom - b * k],
            centre: [r.left + r.width / 2, r.top + r.height / 2],
          };
        };
        const copy = document.querySelector<HTMLElement>("[data-morph-ghost] img[data-morph=photo]");
        return { sheet: read(document.querySelector<HTMLElement>("#sheet img[data-morph=photo]")!), copy: copy ? read(copy) : null };
      });
    const check = (v: Awaited<ReturnType<typeof sample>>, at: string) => {
      expect(v.copy, at).not.toBeNull();
      const c = v.copy!;
      for (const i of [0, 1]) expect(Math.abs((c.centre[i] ?? 0) - (v.sheet.centre[i] ?? 0)), `${at} centre ${JSON.stringify(v)}`).toBeLessThanOrEqual(1);
      const [l, t, r, b] = v.sheet.shown as [number, number, number, number];
      const [cl, ct, cr, cb] = c.shown as [number, number, number, number];
      expect(cl >= l - 1 && ct >= t - 1 && cr <= r + 1 && cb <= b + 1, `${at} inside ${JSON.stringify(v)}`).toBe(true);
    };

    await page.locator(".tile").nth(1).click();
    const plan = await page.evaluate(() => window.morph.plan);
    expect(plan.pairs.find((p: { key: string }) => p.key === "photo").mode).toBe("crossfade");
    for (const ms of [0, 60, 120, 200]) {
      await pauseAt(page, ms);
      check(await sample(), `open at ${ms} ms`);
    }
    await resume(page);
    await page.waitForFunction(() => window.morph.state === "open");

    await page.getByRole("button", { name: "Close" }).click();
    for (const ms of [0, 90, 180]) {
      await pauseAt(page, ms);
      check(await sample(), `close at ${ms} ms`);
    }
    await resume(page);
    await page.waitForFunction(() => window.morph.state === "closed");
    expect(await page.locator("[data-morph-ghost]").count()).toBe(0);
    void errors;
  });

  test("a card cut off by the screen edge, outside a centred panel, still grows from the part you see", async ({ page, errors }) => {
    await page.goto("/tests/fixtures/gallery.html?panel");
    await page.waitForSelector("html[data-ready]", { state: "attached" });
    // Leave only the top 40% of a second-row tile above the bottom edge: below the panel's box.
    await page.evaluate(() => {
      const r = document.querySelectorAll(".tile")[4]!.getBoundingClientRect();
      window.scrollBy({ top: r.top - (innerHeight - r.height * 0.4), behavior: "instant" });
    });
    // What the reader sees of the tile, and of the sheet (its box cut by its clip-path).
    const seen = () =>
      page.evaluate(() => {
        const r = document.querySelectorAll(".tile")[4]!.getBoundingClientRect();
        const tileShown = [r.left, Math.max(0, r.top), r.right, Math.min(innerHeight, r.bottom)];
        const sheet = document.getElementById("sheet")!;
        const b = sheet.getBoundingClientRect();
        const m = /inset\(([^)]*)\)/.exec(getComputedStyle(sheet).clipPath);
        const v = (m?.[1] ?? "0px").split(" round ")[0]?.trim().split(/\s+/).map(Number.parseFloat) ?? [0];
        const t = v[0] ?? 0;
        const rt = v[1] ?? t;
        const bt = v[2] ?? t;
        const l = v[3] ?? rt;
        return { tile: tileShown, sheet: [b.left + l, b.top + t, b.right - rt, b.bottom - bt], panel: [b.left, b.top, b.right, b.bottom] };
      });
    const near = (a: number[], b: number[]) => a.every((n, i) => Math.abs(n - (b[i] ?? 0)) <= 1);
    const before = await seen();

    // A mouse click where the reader sees the tile: locator.click() would scroll it into view first.
    const [x, y] = [(before.tile[0] ?? 0) + 20, (before.tile[1] ?? 0) + 10];
    await page.mouse.click(x, y);
    expect(await page.evaluate(() => window.morph.plan)).toMatchObject({ choreography: "morph" });
    await pauseAt(page, 0);
    const start = await seen();
    expect(near(start.sheet, start.tile), `open starts on the tile: ${JSON.stringify(start)}`).toBe(true);
    await resume(page);
    await page.waitForFunction(() => window.morph.state === "open");
    // The tile's visible part lies outside the panel's own box, so the panel
    // started moved over it; at rest it is back in its place, untouched.
    const open = await seen();
    expect(before.tile[1] ?? 0).toBeGreaterThan(open.panel[3] ?? 0);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById("sheet")!).translate)).toBe("none");

    await page.getByRole("button", { name: "Close" }).click();
    expect(await page.evaluate(() => window.morph.plan)).toMatchObject({ choreography: "morph" });
    await pauseAt(page, 299);
    const end = await seen();
    expect(near(end.sheet, end.tile), `close ends on the tile: ${JSON.stringify(end)}`).toBe(true);
    await resume(page);
    await page.waitForFunction(() => window.morph.state === "closed");
    expect(await page.locator("[data-morph-ghost]").count()).toBe(0);
    void errors;
  });
});
