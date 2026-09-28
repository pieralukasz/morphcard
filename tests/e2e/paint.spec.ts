import { expect, pauseAt, settled, test } from "./helpers";

test("a shared image above a changing cover stays painted throughout open and Back", async ({ page, errors }) => {
  await page.goto("/tests/fixtures/gallery.html");
  await page.waitForSelector("html[data-ready]", { state: "attached" });
  await page.evaluate(async () => {
    window.morph.destroy();
    const path = "/examples/dist/engine.js";
    const { createMorph } = await import(path);
    const src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#00ff00"/></svg>')}`;
    const cover = `<div class="cover"><div class="fill" data-morph="cover" data-morph-mode="box"></div><img class="logo" data-morph="logo" src="${src}" alt="Green logo"></div>`;
    document.body.innerHTML = `<style>
      #card {position:absolute;left:30px;top:100px;width:160px;height:160px}
      #detail {position:fixed;inset:20px;background:white}
      .cover {position:relative;height:160px;display:grid;place-items:center}
      .fill {position:absolute;inset:0;background:#e00000}
      .logo {position:relative;width:64px;height:64px;aspect-ratio:1}
      #detail .cover {height:200px}
      #detail .logo {width:96px;height:96px}
    </style><article id="card">${cover}</article><section id="detail" hidden>${cover}</section>`;
    await Promise.all([...document.images].map((img) => img.decode()));
    window.morph = createMorph({ sheet: document.querySelector("#detail"), backgroundScale: false });
  });
  for (const phase of ["open", "close"] as const) {
    await page.evaluate((phase) => {
      if (phase === "open") void window.morph.open(document.querySelector("#card"));
      else void window.morph.close();
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; }
    }, phase);
    const plan = await page.evaluate(() => window.morph.plan);
    expect(plan.pairs).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "cover", mode: "crossfade" }),
      expect.objectContaining({ key: "logo", mode: "scale" }),
    ]));
    for (const ms of phase === "open" ? [0, 40, 80, 160, 399] : [0, 60, 120, 200, 299]) {
      await pauseAt(page, ms);
      const point = await page.locator("#detail > .cover .logo").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      const png = (await page.screenshot()).toString("base64");
      const rgb = await page.evaluate(async ({ png, point }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        const scale = image.width / innerWidth;
        return [...ctx.getImageData(Math.floor(point.x * scale), Math.floor(point.y * scale), 1, 1).data].slice(0, 3);
      }, { png, point });
      expect(rgb, `${phase} at ${ms} ms: the red cover must not obscure the green image`).toEqual([0, 255, 0]);
    }
    await page.evaluate(() => { for (const a of document.getAnimations()) a.finish(); });
    await settled(page, phase === "open" ? "open" : "closed");
  }
  expect(await page.locator("[data-morph-ghost]").count()).toBe(0);
  void errors;
});
