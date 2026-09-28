import { expect, test, settled } from "./helpers";

test.describe("visibility inside a scaled list", () => {
  for (const axis of ["vertical", "horizontal"] as const) {
    test(`a card clipped ${axis}ly by a smaller list fades on open and Back`, async ({ page, errors }) => {
      await page.goto("/tests/fixtures/gallery.html");
      await page.waitForSelector("html[data-ready]", { state: "attached" });
      await page.evaluate((axis) => {
        const grid = document.getElementById("grid")!;
        Object.assign(grid.style, {
          position: "fixed", top: "60px", left: "20px", width: "160px", height: "160px",
          transform: "scale(0.5)", transformOrigin: "0 0", overflow: "hidden",
          display: "block", padding: "0", border: "10px solid black",
        });
        for (const [i, tile] of [...grid.querySelectorAll<HTMLElement>(".tile")].entries()) {
          Object.assign(tile.style, {
            position: "absolute", width: "60px", height: "40px",
            top: i === 1 && axis === "vertical" ? "180px" : "20px",
            left: i === 1 && axis === "horizontal" ? "180px" : "20px",
            display: i < 2 ? "block" : "none",
          });
        }
        window.morph.setOptions({ backgroundScale: false });
        void window.morph.open(grid.querySelectorAll(".tile")[1]);
      }, axis);
      await settled(page, "open");
      expect(await page.evaluate(() => window.morph.plan)).toMatchObject({ choreography: "fade", reason: "card-offscreen" });
      expect(await page.locator("[data-morph-ghost]").count()).toBe(0);
      await page.evaluate(() => void window.morph.close());
      await settled(page, "closed");
      expect(await page.evaluate(() => window.morph.plan)).toMatchObject({ choreography: "fade", reason: "card-offscreen" });

      // Back can also target a hidden card after opening a visible one.
      await page.evaluate(() => void window.morph.open(document.querySelector(".tile")));
      await settled(page, "open");
      expect(await page.evaluate(() => window.morph.plan.choreography)).toBe("morph");
      await page.evaluate(() => void window.morph.close({ to: document.querySelectorAll(".tile")[1] }));
      await settled(page, "closed");
      expect(await page.evaluate(() => window.morph.plan)).toMatchObject({ choreography: "fade", reason: "card-offscreen" });
      expect(await page.locator("[data-morph-ghost]").count()).toBe(0);
      void errors;
    });
  }

  test("a card still visible in an enlarged list keeps its flight", async ({ page, errors }) => {
    await page.goto("/tests/fixtures/gallery.html");
    await page.waitForSelector("html[data-ready]", { state: "attached" });
    await page.evaluate(() => {
      const grid = document.getElementById("grid")!;
      Object.assign(grid.style, {
        position: "fixed", top: "60px", left: "20px", width: "160px", height: "160px",
        transform: "scale(2)", transformOrigin: "0 0", overflow: "hidden",
        display: "block", padding: "0", border: "10px solid black",
      });
      const tile = grid.querySelector<HTMLElement>(".tile")!;
      Object.assign(tile.style, { position: "absolute", top: "100px", left: "20px", width: "60px", height: "40px" });
      window.morph.setOptions({ backgroundScale: false });
      void window.morph.open(tile);
    });
    await settled(page, "open");
    expect(await page.evaluate(() => window.morph.plan.choreography)).toBe("morph");
    await page.evaluate(() => void window.morph.close());
    await settled(page, "closed");
    expect(await page.evaluate(() => window.morph.plan.choreography)).toBe("morph");
    expect(await page.locator("[data-morph-ghost]").count()).toBe(0);
    void errors;
  });
});
