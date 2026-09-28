import {
  clickCard,
  domSignature,
  expect,
  gotoDemo,
  pauseAt,
  recordAnimations,
  recorded,
  resume,
  settled,
  state,
  test,
} from "./helpers";

// Timing used by the library defaults (see src/morph.ts `defaults`).
const OPEN = 400;
const CLOSE = 300;

const end = (a: { duration: number; delay: number }) => a.duration + a.delay;
const moves = (a: { props: string[] }) => a.props.includes("transform") || a.props.includes("clipPath");

test.describe("open and close", () => {
  test("a click opens the sheet from the card and lands in a clean open state", async ({ page, errors }) => {
    await gotoDemo(page);
    await recordAnimations(page);
    await clickCard(page, "2042");
    await settled(page, "open");

    const plan = await page.evaluate(() => window.morph.plan);
    expect(plan.choreography).toBe("morph");
    expect(plan.pairs.map((p: { key: string }) => p.key)).toEqual(["route", "party", "ref", "badge"]);
    for (const p of plan.pairs) expect(p.mode).not.toBe("skip");

    const final = await page.evaluate(() => {
      const sheet = window.demo.sheet as HTMLElement;
      const shared = [...sheet.querySelectorAll<HTMLElement>("[data-morph]")];
      return {
        hidden: sheet.hidden,
        stateAttr: sheet.getAttribute("data-morph-state"),
        clip: getComputedStyle(sheet).clipPath,
        opacity: getComputedStyle(sheet).opacity,
        sharedTransforms: shared.map((el) => getComputedStyle(el).transform),
        sharedOpacity: shared.map((el) => getComputedStyle(el).opacity),
        backgroundInert: window.demo.screen.inert,
        backgroundTransform: getComputedStyle(window.demo.screen).transform,
        scrimOpacity: getComputedStyle(window.demo.scrim).opacity,
        ghosts: document.querySelectorAll("[data-morph-ghost]").length,
        focus: document.activeElement?.className,
        heading: sheet.querySelector(".mc-head .mc-route")?.textContent,
      };
    });
    expect(final.hidden).toBe(false);
    expect(final.stateAttr).toBe("open");
    expect(final.clip).toBe("none");
    expect(final.opacity).toBe("1");
    expect(final.sharedTransforms.every((t: string) => t === "none")).toBe(true);
    expect(final.sharedOpacity.every((o: string) => o === "1")).toBe(true);
    expect(final.backgroundInert).toBe(true);
    expect(final.backgroundTransform).toBe("matrix(0.96, 0, 0, 0.96, 0, 0)");
    expect(final.scrimOpacity).toBe("1");
    expect(final.ghosts).toBe(0);
    expect(final.focus).toContain("mc-back");
    expect(final.heading).toContain("Lyon");

    // The surface grew from the card with clip-path, not from a transform.
    const anims = await recorded(page);
    const surface = anims.filter((a) => a.target === "sheet");
    expect(surface.some((a) => a.props.includes("clipPath") && a.duration === OPEN)).toBe(true);
    expect(surface.some((a) => a.props.includes("transform"))).toBe(false);
    void errors;
  });

  test("closing returns to the card and leaves the DOM exactly as it was", async ({ page, errors }) => {
    await gotoDemo(page);
    const before = await domSignature(page);
    await clickCard(page, "2041");
    await settled(page, "open");
    await page.getByRole("button", { name: "Back" }).click();
    await settled(page, "closed");
    expect(await domSignature(page)).toEqual(before);
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toContain("Open delivery 2041");
    void errors;
  });

  test("Escape closes the sheet", async ({ page, errors }) => {
    await gotoDemo(page);
    await clickCard(page, "2043");
    await settled(page, "open");
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    expect(await page.evaluate(() => window.demo.sheet.hidden)).toBe(true);
    void errors;
  });

  test("the list is inert while the sheet is open", async ({ page, errors }) => {
    await gotoDemo(page);
    await clickCard(page, "2041");
    await settled(page, "open");
    expect(await page.evaluate(() => window.demo.screen.inert)).toBe(true);
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    expect(await page.evaluate(() => window.demo.screen.inert)).toBe(false);
    void errors;
  });
});

test.describe("timing", () => {
  test("closing is quicker than opening and ends with the background", async ({ page, errors }) => {
    await gotoDemo(page);
    await recordAnimations(page);
    await clickCard(page, "2042");
    await settled(page, "open");
    const opening = await recorded(page);
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    const closing = await recorded(page);

    const openEnd = Math.max(...opening.map(end));
    const closeEnd = Math.max(...closing.map(end));
    expect(closeEnd).toBeLessThan(openEnd);

    // Nothing moves after the list has settled back into place.
    const background = closing.filter((a) => a.target === "background" || a.target === "scrim");
    expect(background.length).toBeGreaterThan(0);
    const backgroundEnd = Math.max(...background.map(end));
    expect(backgroundEnd).toBe(CLOSE);
    for (const a of closing) expect(end(a), `${a.target} ${a.props}`).toBeLessThanOrEqual(backgroundEnd);
    void errors;
  });

  test("texts that wrap differently crossfade, and the heading gives way early on close", async ({ page, errors }) => {
    await gotoDemo(page);
    // Narrow the heading's company line so it wraps onto more lines than the card's.
    await page.addStyleTag({ content: ".mc-head .mc-party { max-width: 90px }" });
    await recordAnimations(page);
    await clickCard(page, "2042");
    await settled(page, "open");
    const plan = await page.evaluate(() => window.morph.plan);
    expect(plan.pairs.find((p: { key: string }) => p.key === "party").mode).toBe("crossfade");
    await recorded(page);

    await page.keyboard.press("Escape");
    await settled(page, "closed");
    const closing = await recorded(page);
    // The big heading version fades out within the first 30% of the close...
    const headingOut = closing.filter((a) => a.target === "shared:party" && !a.inGhost && a.props.includes("opacity"));
    expect(headingOut).toHaveLength(1);
    expect(end(headingOut[0])).toBeLessThanOrEqual(CLOSE * 0.3 + 1);
    // ...and the card's own text is already fully visible by ~37%.
    const cardIn = closing.filter((a) => a.target === "shared:party" && a.inGhost && a.props.includes("opacity"));
    expect(cardIn).toHaveLength(1);
    expect(end(cardIn[0])).toBeLessThanOrEqual(CLOSE * 0.37 + 1);
    // Both copies travel the same path for the whole close.
    const paths = closing.filter((a) => a.target === "shared:party" && a.props.includes("transform"));
    expect(paths).toHaveLength(2);
    for (const a of paths) expect(a.duration).toBe(CLOSE);
    void errors;
  });

  test("content enters with a stagger after the surface has room", async ({ page, errors }) => {
    await gotoDemo(page);
    await recordAnimations(page);
    await clickCard(page, "2041");
    await settled(page, "open");
    const staggered = (await recorded(page)).filter((a) => a.props.includes("opacity") && a.props.includes("transform") && a.inSheet && !a.target.startsWith("shared"));
    const delays = staggered.map((a) => a.delay);
    expect(delays.length).toBeGreaterThanOrEqual(4);
    expect(delays[0]).toBeCloseTo(130, 5);
    for (let i = 1; i < delays.length; i++) expect(delays[i] - delays[i - 1]).toBeCloseTo(45, 5);
    void errors;
  });
});

test.describe("interruptions", () => {
  test("closing mid-open reverses from the current point without a jump", async ({ page, errors }) => {
    await gotoDemo(page);
    await page.evaluate(() => {
      window.demo.open("2042");
    });
    await pauseAt(page, 150);
    // Read, reverse and read again in one task, so no frame passes in between.
    const { beforeFlip, afterFlip, rates } = await page.evaluate(() => {
      const read = () => {
        const route = window.demo.sheet.querySelector(".mc-head .mc-route") as HTMLElement;
        const r = route.getBoundingClientRect();
        return { clip: getComputedStyle(window.demo.sheet).clipPath, top: r.top, left: r.left, width: r.width };
      };
      const beforeFlip = read();
      window.demo.close();
      const afterFlip = read();
      const rates = document
        .getAnimations()
        .filter((x) => !(x instanceof CSSTransition))
        .map((x) => x.playbackRate);
      return { beforeFlip, afterFlip, rates };
    });
    expect(await state(page)).toBe("closing");
    const insets = (clip: string) => (clip.match(/[\d.]+px/g) ?? []).map(Number.parseFloat);
    const a = insets(beforeFlip.clip);
    const b = insets(afterFlip.clip);
    expect(a.length).toBeGreaterThan(0);
    for (let i = 0; i < a.length; i++) expect(Math.abs((a[i] ?? 0) - (b[i] ?? 0))).toBeLessThan(1);
    expect(Math.abs(beforeFlip.top - afterFlip.top)).toBeLessThan(1);
    expect(Math.abs(beforeFlip.width - afterFlip.width)).toBeLessThan(1);

    // The same animations now run backwards, faster: no new run was built.
    expect(rates.every((r) => r < 0)).toBe(true);
    expect(rates[0]).toBeCloseTo(-OPEN / CLOSE, 5);
    await resume(page);
    await settled(page, "closed");
    const sig = await domSignature(page);
    expect(sig.ghosts).toBe(0);
    expect(sig.animations).toBe(0);
    void errors;
  });

  test("opening the same card mid-close turns back to open", async ({ page, errors }) => {
    await gotoDemo(page);
    await clickCard(page, "2043");
    await settled(page, "open");
    await page.evaluate(() => {
      window.demo.close();
    });
    await pauseAt(page, 100);
    await page.evaluate(() => {
      window.demo.open("2043");
    });
    expect(await state(page)).toBe("opening");
    await resume(page);
    await settled(page, "open");
    expect(await page.evaluate(() => document.activeElement?.className)).toContain("mc-back");
    void errors;
  });

  test("a card clicked while another closes opens cleanly (the newer run owns the state)", async ({ page, errors }) => {
    await gotoDemo(page);
    const before = await domSignature(page);
    await clickCard(page, "2041");
    await settled(page, "open");
    await page.evaluate(() => {
      window.demo.close();
    });
    await pauseAt(page, 60);
    // The sheet is inert while it shrinks, so this click reaches the list.
    await page.locator('.mc-card[data-id="2042"] .mc-card-hit').click();
    await settled(page, "open");
    expect(await page.evaluate(() => window.morph.card?.dataset.id)).toBe("2042");
    expect(await page.evaluate(() => window.demo.sheet.querySelector(".mc-head .mc-route")?.textContent)).toContain("Lyon");
    const open = await domSignature(page);
    expect(open.ghosts).toBe(0);
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    expect(await domSignature(page)).toEqual(before);
    void errors;
  });

  test("a rapid double click opens once and leaves nothing behind", async ({ page, errors }) => {
    await gotoDemo(page);
    const before = await domSignature(page);
    await recordAnimations(page);
    await page.locator('.mc-card[data-id="2041"] .mc-card-hit').dblclick();
    await settled(page, "open");
    expect(await page.evaluate(() => window.ghostsSeen)).toBe(1);
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    expect(await domSignature(page)).toEqual(before);
    void errors;
  });

  test("any burst of open and close calls ends in a clean state", async ({ page, errors }) => {
    await gotoDemo(page);
    const before = await domSignature(page);
    await page.evaluate(async () => {
      const d = window.demo;
      d.open("2041");
      d.close();
      d.open("2041");
      d.close();
      d.open("2042");
      await new Promise((r) => setTimeout(r, 30));
      d.close();
      d.open("2042");
      await new Promise((r) => setTimeout(r, 30));
      d.open("2043");
      d.close();
    });
    await settled(page, "closed");
    expect(await domSignature(page)).toEqual(before);

    await page.evaluate(() => {
      const d = window.demo;
      d.open("2041");
      d.close();
      d.open("2041");
    });
    await settled(page, "open");
    const open = await domSignature(page);
    expect(open.ghosts).toBe(0);
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    expect(await domSignature(page)).toEqual(before);
    void errors;
  });

  test("destroy() mid-transition restores the page", async ({ page, errors }) => {
    await gotoDemo(page);
    const before = await domSignature(page);
    await page.evaluate(() => {
      window.demo.open("2042");
    });
    await pauseAt(page, 120);
    await page.evaluate(() => window.demo.destroy());
    expect(await domSignature(page)).toEqual(before);
    expect(await page.evaluate(() => window.demo.open("2042"))).toBe(false);
    void errors;
  });
});

test.describe("reduced motion", () => {
  test("prefers-reduced-motion fades only, surface first, content after", async ({ page, errors }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoDemo(page);
    await recordAnimations(page);
    await clickCard(page, "2042");
    await settled(page, "open");
    const opening = await recorded(page);
    expect(await page.evaluate(() => window.morph.plan.choreography)).toBe("fade");
    expect(opening.filter(moves)).toEqual([]);
    const surface = opening.find((a) => a.target === "sheet");
    const content = opening.filter((a) => a.inSheet && a.target !== "sheet");
    expect(surface.delay).toBe(0);
    expect(content.length).toBeGreaterThan(0);
    for (const a of content) expect(a.delay).toBeGreaterThanOrEqual(100);
    expect(await page.evaluate(() => getComputedStyle(window.demo.screen).transform)).toBe("none");

    await page.keyboard.press("Escape");
    await settled(page, "closed");
    expect((await recorded(page)).filter(moves)).toEqual([]);
    expect(await page.evaluate(() => document.querySelectorAll("[data-morph-ghost]").length)).toBe(0);
    void errors;
  });

  test("the reducedMotion option forces the same", async ({ page, errors }) => {
    await gotoDemo(page, "reduce");
    await recordAnimations(page);
    await clickCard(page, "2041");
    await settled(page, "open");
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    expect((await recorded(page)).filter(moves)).toEqual([]);
    void errors;
  });
});

test.describe("flights that must not happen", () => {
  test("a missing destination element fades instead of flying", async ({ page, errors }) => {
    await gotoDemo(page);
    await page.evaluate(() => window.demo.sheet.querySelector('.mc-head [data-morph="ref"]')?.remove());
    await recordAnimations(page);
    await clickCard(page, "2042");
    await settled(page, "open");
    const plan = await page.evaluate(() => window.morph.plan);
    // The key is gone from the sheet, so it is not even considered.
    expect(plan.pairs.map((p: { key: string }) => p.key)).not.toContain("ref");
    const anims = await recorded(page);
    // The card's copy of the reference only fades in place.
    const refMoves = anims.filter((a) => a.target === "shared:ref" && a.props.includes("transform"));
    expect(refMoves).toEqual([]);
    expect(anims.some((a) => a.target === "shared:ref" && a.inGhost && a.props.includes("opacity"))).toBe(true);
    void errors;
  });

  test("a destination outside the viewport is never a flight target", async ({ page, errors }) => {
    await gotoDemo(page);
    // Push the heading far below the fold of the sheet.
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "3000px";
      spacer.className = "spacer";
      window.demo.sheet.querySelector(".mc-back")?.after(spacer);
    });
    await recordAnimations(page);
    await clickCard(page, "2042");
    await settled(page, "open");
    const plan = await page.evaluate(() => window.morph.plan);
    for (const p of plan.pairs) expect(p).toMatchObject({ mode: "skip", reason: "sheet-element-offscreen" });
    const opening = await recorded(page);
    expect(opening.filter((a) => a.target.startsWith("shared:") && a.props.includes("transform"))).toEqual([]);
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    const closing = await recorded(page);
    expect(closing.filter((a) => a.target.startsWith("shared:") && a.props.includes("transform"))).toEqual([]);
    void errors;
  });

  test("leaving for another screen (close to nothing) only fades", async ({ page, errors }) => {
    await gotoDemo(page);
    const before = await domSignature(page);
    await clickCard(page, "2042");
    await settled(page, "open");
    await recordAnimations(page);
    await page.evaluate(() => {
      window.demo.close({ to: null });
    });
    await settled(page, "closed");
    const plan = await page.evaluate(() => window.morph.plan);
    expect(plan).toMatchObject({ direction: "close", choreography: "fade", reason: "no-card" });
    const closing = await recorded(page);
    expect(closing.filter((a) => a.target.startsWith("shared:") || a.props.includes("clipPath"))).toEqual([]);
    expect(await page.evaluate(() => window.ghostsSeen)).toBe(0);
    expect(await domSignature(page)).toEqual(before);
    void errors;
  });

  test("a deep link opens without a card and closes without a flight", async ({ page, errors }) => {
    await gotoDemo(page);
    await recordAnimations(page);
    await page.evaluate(() => {
      window.demo.openDirect("2050");
    });
    await settled(page, "open");
    expect(await page.evaluate(() => window.morph.plan)).toMatchObject({ choreography: "fade", reason: "no-card" });
    expect(await page.evaluate(() => window.demo.sheet.querySelector(".mc-head .mc-route")?.textContent)).toContain("Dublin");
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    const all = await recorded(page);
    expect(all.filter((a) => a.target.startsWith("shared:") && a.props.includes("transform"))).toEqual([]);
    expect(await page.evaluate(() => window.ghostsSeen)).toBe(0);
    void errors;
  });

  test("returning to a card far below the fold does not fly", async ({ page, errors }) => {
    await gotoDemo(page);
    await clickCard(page, "2041");
    await settled(page, "open");
    await recordAnimations(page);
    // The list row the detail belongs to is now far off screen.
    await page.evaluate(() => {
      window.demo.close({ to: window.demo.card("2050") });
    });
    await settled(page, "closed");
    expect(await page.evaluate(() => window.morph.plan)).toMatchObject({ choreography: "fade", reason: "card-offscreen" });
    const closing = await recorded(page);
    expect(closing.filter((a) => a.target.startsWith("shared:") || a.props.includes("clipPath"))).toEqual([]);
    void errors;
  });

  test("a background with position:fixed children is never transformed", async ({ page, errors }) => {
    await gotoDemo(page);
    await page.evaluate(() => {
      const fab = document.createElement("button");
      fab.textContent = "+";
      fab.className = "fixed-fab";
      Object.assign(fab.style, { position: "fixed", right: "16px", bottom: "80px", width: "48px", height: "48px" });
      window.demo.screen.append(fab);
    });
    await recordAnimations(page);
    await clickCard(page, "2041");
    await settled(page, "open");
    const plan = await page.evaluate(() => window.morph.plan);
    expect(plan.backgroundScaled).toBe(false);
    const opening = await recorded(page);
    expect(opening.filter((a) => a.target === "background")).toEqual([]);
    expect(await page.evaluate(() => getComputedStyle(window.demo.screen).transform)).toBe("none");
    const fab = await page.evaluate(() => document.querySelector(".fixed-fab")?.getBoundingClientRect().right);
    expect(fab).toBe(await page.evaluate(() => document.documentElement.clientWidth - 16));
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    void errors;
  });
});

test.describe("scroll and focus", () => {
  test("closing restores the list scroll before measuring, and focus does not move it", async ({ page, errors }) => {
    await gotoDemo(page);
    await page.locator('.mc-card[data-id="2048"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 40));
    const scrolled = await page.evaluate(() => window.scrollY);
    expect(scrolled).toBeGreaterThan(0);
    await page.locator('.mc-card[data-id="2048"] .mc-card-hit').click();
    await settled(page, "open");
    // Something resets the page scroll while the detail is open.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await recordAnimations(page);
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    expect(await page.evaluate(() => window.morph.plan.choreography)).toBe("morph");
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toContain("2048");
    // The surface shrank to where the card really is.
    const clip = (await recorded(page)).find((a) => a.target === "sheet" && a.props.includes("clipPath"));
    const cardTop = await page.evaluate(() => window.demo.card("2048").getBoundingClientRect().top);
    const sheetTop = await page.evaluate(() => {
      window.demo.sheet.hidden = false;
      const top = window.demo.sheet.getBoundingClientRect().top;
      window.demo.sheet.hidden = true;
      return top;
    });
    const insetTop = Number.parseFloat(String(clip.frames[1].clipPath).slice("inset(".length));
    expect(Math.abs(insetTop - (cardTop - sheetTop))).toBeLessThan(1);
    void errors;
  });

  test("the list inside a scrolling frame is restored too", async ({ page, errors }) => {
    await gotoDemo(page, "layout=frame&h=700");
    await page.evaluate(() => {
      window.demo.screen.scrollTop = 520;
    });
    const scrolled = await page.evaluate(() => window.demo.screen.scrollTop);
    const visible = await page.evaluate(() => {
      const box = window.demo.screen.getBoundingClientRect();
      const card = [...window.demo.list.querySelectorAll(".mc-card")].find((c) => {
        const r = (c as HTMLElement).getBoundingClientRect();
        return r.top > box.top + 20 && r.bottom < box.bottom - 20;
      }) as HTMLElement;
      return card.dataset.id as string;
    });
    await page.locator(`.mc-card[data-id="${visible}"] .mc-card-hit`).click();
    await settled(page, "open");
    await page.evaluate(() => {
      window.demo.screen.scrollTop = 0;
    });
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    expect(await page.evaluate(() => window.morph.plan.choreography)).toBe("morph");
    expect(await page.evaluate(() => window.demo.screen.scrollTop)).toBe(scrolled);
    void errors;
  });

  test("keyboard: Enter opens, focus lands on Back, Escape returns focus to the card", async ({ page, errors }) => {
    await gotoDemo(page);
    const hit = page.locator('.mc-card[data-id="2043"] .mc-card-hit');
    await hit.focus();
    await page.keyboard.press("Enter");
    await settled(page, "open");
    await expect(page.getByRole("button", { name: "Back" })).toBeFocused();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await settled(page, "closed");
    await expect(hit).toBeFocused();
    await expect(page.getByRole("dialog")).toBeHidden();
    void errors;
  });
});

test.describe("scaled frame", () => {
  // A preview frame shrunk with a CSS transform (the docs site does this to
  // fit a desktop window on a small screen). Rects come back in screen
  // pixels; clip insets and transforms must be written in the frame's own.
  test("the surface starts exactly on the card and flights land on their targets", async ({ page, errors }) => {
    await gotoDemo(page, "layout=frame&w=390&h=800&zoom=0.5");
    await clickCard(page, "2042");
    await pauseAt(page, 0);
    const start = await page.evaluate(() => {
      const card = window.demo.card("2042").getBoundingClientRect();
      const sheet = window.demo.sheet as HTMLElement;
      const s = sheet.getBoundingClientRect();
      const clip = getComputedStyle(sheet).clipPath;
      // Computed clip-path uses the shortest inset() shorthand: 1 to 4 values,
      // expanded like margin (top, right = top, bottom = top, left = right).
      const values = (clip.match(/inset\(([^)]*?)(?: round|\))/)?.[1] ?? "0")
        .trim()
        .split(/\s+/)
        .map(Number.parseFloat);
      const unit = s.width / sheet.offsetWidth;
      const top = values[0] ?? 0;
      const right = values[1] ?? top;
      const bottom = values[2] ?? top;
      const left = values[3] ?? right;
      return {
        unit,
        clip: { left: s.left + left * unit, top: s.top + top * unit, right: s.right - right * unit, bottom: s.bottom - bottom * unit },
        card: { left: card.left, top: card.top, right: card.right, bottom: card.bottom },
        route: window.demo.sheet.querySelector(".mc-head [data-morph='route']").getBoundingClientRect().left,
        cardRoute: window.demo.card("2042").querySelector("[data-morph='route']").getBoundingClientRect().left,
      };
    });
    expect(start.unit).toBeCloseTo(0.5, 3);
    for (const side of ["left", "top", "right", "bottom"] as const) {
      expect(Math.abs(start.clip[side] - start.card[side]), side).toBeLessThan(1);
    }
    expect(Math.abs(start.route - start.cardRoute)).toBeLessThan(1);

    await resume(page);
    await settled(page, "open");
    const landed = await page.evaluate(() => {
      const r = window.demo.sheet.querySelector(".mc-head [data-morph='route']") as HTMLElement;
      return { transform: getComputedStyle(r).transform, clip: getComputedStyle(window.demo.sheet).clipPath };
    });
    expect(landed.transform).toBe("none");
    expect(landed.clip).toBe("none");

    await page.keyboard.press("Escape");
    await settled(page, "closed");
    const signature = await domSignature(page);
    expect(signature.ghosts).toBe(0);
    expect(signature.animations).toBe(0);
    void errors;
  });
});
