import { describe, expect, it } from "vitest";
import {
  ASPECT_TOLERANCE,
  backgroundOrigin,
  box,
  fullClip,
  insetClip,
  intersect,
  isOnScreen,
  lineCount,
  parseRadius,
  placeOver,
  planPair,
  visibleRatio,
} from "../../src/geometry";

describe("intersect and visibility", () => {
  const viewport = box(0, 0, 390, 800);

  it("returns the overlap of two boxes", () => {
    expect(intersect(box(0, 0, 100, 100), box(50, 50, 100, 100))).toEqual(box(50, 50, 50, 50));
  });

  it("returns null when boxes only touch or are apart", () => {
    expect(intersect(box(0, 0, 100, 100), box(100, 0, 50, 50))).toBeNull();
    expect(intersect(box(0, 0, 10, 10), box(500, 500, 10, 10))).toBeNull();
  });

  it("measures how much of a box is visible", () => {
    expect(visibleRatio(box(0, 700, 390, 200), viewport)).toBeCloseTo(0.5);
    expect(visibleRatio(box(0, 900, 390, 100), viewport)).toBe(0);
    expect(visibleRatio(box(0, 10, 390, 100), viewport)).toBe(1);
  });

  it("treats empty boxes and a missing visible area as hidden", () => {
    expect(visibleRatio(box(10, 10, 0, 0), viewport)).toBe(0);
    expect(visibleRatio(box(10, 10, 50, 50), null)).toBe(0);
  });

  it("calls a card below the fold off screen", () => {
    // A list row far below the fold, as after a deep link to its detail.
    expect(isOnScreen(box(16, 2400, 358, 110), viewport)).toBe(false);
    // Mostly hidden under the bottom edge.
    expect(isOnScreen(box(16, 760, 358, 110), viewport)).toBe(false);
    // Mostly visible.
    expect(isOnScreen(box(16, 700, 358, 110), viewport)).toBe(true);
  });
});

describe("clip paths", () => {
  const sheet = box(0, 60, 390, 740);

  it("clips the sheet to the card, relative to the sheet", () => {
    const card = box(16, 300, 358, 110);
    expect(insetClip(card, sheet, 16)).toBe("inset(240px 16px 390px 16px round 16px)");
  });

  it("never produces negative insets for a card that sticks out", () => {
    const card = box(-10, 20, 420, 100);
    expect(insetClip(card, sheet, 12)).toBe("inset(0px 0px 680px 0px round 12px)");
  });

  it("rounds to hundredths of a pixel", () => {
    expect(insetClip(box(16.123, 300.456, 358, 110), sheet, 16)).toBe(
      "inset(240.46px 15.88px 389.54px 16.12px round 16px)",
    );
  });

  it("describes the full sheet with the same number of values", () => {
    // Both keyframes need the same shape of inset() to interpolate.
    expect(fullClip(0)).toBe("inset(0px 0px 0px 0px round 0px)");
  });
});

describe("parseRadius", () => {
  it("reads the first px length", () => {
    expect(parseRadius("16px")).toBe(16);
    expect(parseRadius("12.5px 4px")).toBe(12.5);
  });

  it("resolves percentages against the width", () => {
    expect(parseRadius("50%", 40)).toBe(20);
  });

  it("falls back to square corners", () => {
    expect(parseRadius("")).toBe(0);
    expect(parseRadius(undefined)).toBe(0);
    expect(parseRadius("inherit")).toBe(0);
  });
});

describe("lineCount", () => {
  it("counts lines from a px line height", () => {
    expect(lineCount(40, "20px", 15)).toBe(2);
    expect(lineCount(18, "18px", 13)).toBe(1);
  });

  it("accepts a unitless line height", () => {
    expect(lineCount(64, "1.3333", 24)).toBe(2);
  });

  it("does not return NaN for line-height: normal", () => {
    expect(lineCount(36, "normal", 15)).toBe(2);
  });
});

describe("planPair: scale or crossfade", () => {
  // A route on the card at 15px and in the heading at 24px, laid out in em,
  // so the heading box is the card box times 24/15.
  const k = 15 / 24;
  const dst = box(20, 100, 300, 64);
  const src = box(32, 420, 300 * k, 64 * k);

  it("scales one copy when both versions wrap the same way", () => {
    const plan = planPair({ src, dst, mode: "text", srcFont: 15, dstFont: 24, srcLines: 2, dstLines: 2 });
    expect(plan.crossfade).toBe(false);
    expect(plan.scale).toBeCloseTo(k);
  });

  it("crossfades when the line count differs", () => {
    const plan = planPair({ src, dst, mode: "text", srcFont: 15, dstFont: 24, srcLines: 1, dstLines: 2 });
    expect(plan.crossfade).toBe(true);
  });

  it("crossfades when the card text is cut off with an ellipsis", () => {
    const plan = planPair({ src, dst, mode: "text", srcFont: 15, dstFont: 24, srcLines: 2, dstLines: 2, srcClipped: true });
    expect(plan.crossfade).toBe(true);
  });

  it("crossfades when the box proportions drift past the tolerance", () => {
    const wider = box(src.left, src.top, src.width * (1 + ASPECT_TOLERANCE * 2), src.height);
    const plan = planPair({ src: wider, dst, mode: "text", srcFont: 15, dstFont: 24, srcLines: 2, dstLines: 2 });
    expect(plan.crossfade).toBe(true);
  });

  it("tolerates sub-pixel rounding", () => {
    const rounded = box(src.left, src.top, Math.round(src.width), Math.round(src.height));
    const plan = planPair({ src: rounded, dst, mode: "text", srcFont: 15, dstFont: 24, srcLines: 2, dstLines: 2 });
    expect(plan.crossfade).toBe(false);
  });

  it("scales boxes (images) by width and crossfades on a different aspect ratio", () => {
    expect(planPair({ src: box(0, 0, 40, 40), dst: box(0, 0, 200, 200), mode: "box" })).toEqual({ scale: 0.2, crossfade: false });
    expect(planPair({ src: box(0, 0, 40, 40), dst: box(0, 0, 200, 120), mode: "box" }).crossfade).toBe(true);
  });

  it("never divides by zero for an empty destination", () => {
    const plan = planPair({ src, dst: box(0, 0, 0, 0), mode: "text", srcFont: 15, dstFont: 24 });
    expect(plan.crossfade).toBe(true);
    expect(Number.isFinite(plan.scale)).toBe(true);
  });
});

describe("transforms", () => {
  it("places an element over another box with origin 0 0", () => {
    expect(placeOver(box(20, 100, 300, 64), box(32, 420, 187.5, 40), 0.625)).toBe(
      "translate(12px, 320px) scale(0.625)",
    );
  });

  it("scales the background around what the reader sees", () => {
    // A long page scrolled by 1000px: the origin sits in the visible part.
    const page = box(0, -1000, 1280, 4000);
    const visible = box(0, 0, 1280, 800);
    expect(backgroundOrigin(page, visible)).toBe("640px 1240px");
    expect(backgroundOrigin(box(0, 0, 400, 1000), null)).toBe("200px 300px");
  });
});
