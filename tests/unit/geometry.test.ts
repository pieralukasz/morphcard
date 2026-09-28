import { describe, expect, it } from "vitest";
import {
  ASPECT_TOLERANCE,
  backgroundOrigin,
  box,
  coverShift,
  fillFrames,
  fullClip,
  insetClip,
  intersect,
  isOnScreen,
  lineCount,
  parseRadius,
  placeOver,
  planPair,
  toLocal,
  unitOf,
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

describe("scaled ancestors", () => {
  it("unitOf is rendered width over layout width, and 1 when unusable", () => {
    expect(unitOf(234, 390)).toBeCloseTo(0.6, 5);
    expect(unitOf(390, 390)).toBe(1);
    expect(unitOf(390.2, 390)).toBe(1);
    expect(unitOf(0, 390)).toBe(1);
    expect(unitOf(200, 0)).toBe(1);
    expect(unitOf(Number.NaN, 390)).toBe(1);
  });

  it("toLocal converts screen boxes to the CSS pixels of the scaled subtree", () => {
    expect(toLocal(box(60, 120, 234, 30), 0.6)).toEqual(box(100, 200, 390, 50));
    const same = box(1, 2, 3, 4);
    expect(toLocal(same, 1)).toBe(same);
  });

  it("an inset clip from converted boxes matches the unscaled one", () => {
    const sheet = box(0, 60, 390, 740);
    const card = box(16, 200, 358, 120);
    const scaled = (b: ReturnType<typeof box>) => box(b.left * 0.5, b.top * 0.5, b.width * 0.5, b.height * 0.5);
    expect(insetClip(toLocal(scaled(card), 0.5), toLocal(scaled(sheet), 0.5), 16)).toBe(insetClip(card, sheet, 16));
  });
});

describe("fillFrames: a picture that changes shape", () => {
  const parse = (f: { transform: string; clipPath: string }) => {
    const [tx, ty, sc] = (f.transform.match(/-?[\d.]+/g) ?? []).map(Number);
    const [t, r, b, l] = (f.clipPath.match(/-?[\d.]+/g) ?? []).map(Number);
    return { tx: tx ?? 0, ty: ty ?? 0, s: sc ?? 1, t: t ?? 0, r: r ?? 0, b: b ?? 0, l: l ?? 0 };
  };
  type F = { transform: string; clipPath: string };
  // What part of the screen a layer laid out at `at` shows.
  const shown = (at: ReturnType<typeof box>, f: F) => {
    const p = parse(f);
    const left = at.left + p.tx;
    const top = at.top + p.ty;
    return [left + p.l * p.s, top + p.t * p.s, left + (at.width - p.r) * p.s, top + (at.height - p.b) * p.s];
  };
  // Where a point of a layer's own box lands on screen.
  const point = (at: ReturnType<typeof box>, f: F, x: number, y: number) => {
    const p = parse(f);
    return [at.left + p.tx + x * p.s, at.top + p.ty + y * p.s];
  };
  // A 4:3 poster cropped from the top of a tall 780x1600 video.
  const small = box(40, 500, 176, 132);
  const big = box(300, 40, 272, 558);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  for (const align of [
    [0.5, 0],
    [0.5, 0.5],
  ] as [number, number][]) {
    it(`both copies show the same point of the picture in the same place (align ${align})`, () => {
      const f = fillFrames({ big, small, from: small, to: big, align });
      expect(f.big).toHaveLength(f.small.length);
      // The small picture is the large one scaled by k and cropped at align.
      const k = Math.max(small.width / big.width, small.height / big.height);
      const cx = align[0] * (big.width * k - small.width);
      const cy = align[1] * (big.height * k - small.height);
      f.big.forEach((bf, i) => {
        const sf = f.small[i] as F;
        for (const [x, y] of [
          [0, 0],
          [small.width, small.height],
          [small.width / 2, small.height / 3],
        ] as [number, number][]) {
          const a = point(small, sf, x, y);
          const b = point(big, bf, (x + cx) / k, (y + cy) / k);
          expect(a[0]).toBeCloseTo(b[0] as number, 1);
          expect(a[1]).toBeCloseTo(b[1] as number, 1);
        }
      });
    });
  }

  it("the large copy fills the moving frame and the small one stays inside it", () => {
    const f = fillFrames({ big, small, from: small, to: big, align: [0.5, 0] });
    f.big.forEach((bf, i) => {
      const t = i / (f.big.length - 1);
      const frame = [lerp(40, 300, t), lerp(500, 40, t), lerp(216, 572, t), lerp(632, 598, t)];
      const b = shown(big, bf);
      const s = shown(small, f.small[i] as F);
      b.forEach((n, j) => expect(n).toBeCloseTo(frame[j] as number, 1));
      expect(s[0]).toBeGreaterThanOrEqual((frame[0] as number) - 0.01);
      expect(s[1]).toBeGreaterThanOrEqual((frame[1] as number) - 0.01);
      expect(s[2]).toBeLessThanOrEqual((frame[2] as number) + 0.01);
      expect(s[3]).toBeLessThanOrEqual((frame[3] as number) + 0.01);
    });
  });

  it("starts on the card picture and ends on the sheet picture, untransformed", () => {
    const f = fillFrames({ big, small, from: small, to: big, align: [0.5, 0] });
    expect(f.small[0]?.transform).toBe("translate(0px, 0px) scale(1)");
    expect(f.big.at(-1)?.transform).toBe("translate(0px, 0px) scale(1)");
    expect(f.big[0]?.offset).toBe(0);
    expect(f.big.at(-1)?.offset).toBe(1);
  });

  it("two different boxes (crop: false) each cover the same moving frame", () => {
    const f = fillFrames({ big, small, from: small, to: big, crop: false });
    f.big.forEach((bf, i) => {
      const a = shown(big, bf);
      const b = shown(small, f.small[i] as F);
      a.forEach((n, j) => expect(n).toBeCloseTo(b[j] as number, 1));
    });
  });

  it("never uses negative insets", () => {
    const f = fillFrames({ big, small, from: big, to: small, align: [0.5, 0.5], radius: [14, 10] });
    for (const fr of [...f.big, ...f.small]) {
      const p = parse(fr);
      for (const n of [p.t, p.r, p.b, p.l]) expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns nothing for a picture without a size", () => {
    expect(fillFrames({ big: box(0, 0, 0, 10), small, from: small, to: big })).toEqual({ big: [], small: [] });
  });
});

describe("coverShift: move a centred panel over a card it does not cover", () => {
  const panel = box(280, 68, 880, 765);
  it("does not move a panel that already covers the card", () => {
    expect(coverShift(box(300, 100, 200, 200), panel)).toEqual({ x: 0, y: 0 });
  });
  it("moves down by just enough for a card cut off at the bottom edge", () => {
    // The visible strip of a card at the bottom of a 900 px screen.
    expect(coverShift(box(300, 860, 266, 40), panel)).toEqual({ x: 0, y: 900 - 833 });
  });
  it("moves sideways and up for a card left of and above the panel", () => {
    expect(coverShift(box(20, 10, 200, 100), panel)).toEqual({ x: -260, y: -58 });
  });
  it("lands inside a card larger than the panel", () => {
    const big = box(0, 0, 1440, 900);
    const s = coverShift(big, box(-100, 50, 400, 300));
    expect(s).toEqual({ x: 100, y: 0 });
  });
});
