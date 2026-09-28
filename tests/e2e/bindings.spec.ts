import { expect, test } from "./helpers";

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
});
