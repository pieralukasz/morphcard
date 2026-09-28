import { type Box, area, backgroundOrigin, intersect, isOnScreen, moveBox, coverShift, NO_SHIFT, parseRadius, planPair, toLocal, unitOf } from "./geometry";
import { hasFixedDescendant, isClipped, rectOf as screenRectOf, sharedElements, textLines, visibleBoxOf as screenVisibleBoxOf } from "./dom";
import type { MorphOptions, SkipReason } from "./types";
import type { Geometry, PairGeometry } from "./transition";

const TRANSPARENT = /^(transparent|rgba\(0, 0, 0, 0\))$/;

const ZERO: Box = { left: 0, top: 0, width: 0, height: 0 };

/** Jumps CSS transitions on the card (hover, press) to their end so the card is measured at rest. */
function settleTransitions(card: HTMLElement) {
  if (typeof card.getAnimations !== "function") return;
  for (const a of card.getAnimations({ subtree: true })) {
    if (typeof CSSTransition !== "undefined" && a instanceof CSSTransition) a.finish();
  }
}

/** Smallest visible strip of a card, in px, that a flight starts from or lands on. */
const MIN_SEEN = 8;

function isSeen(b: Box | null): b is Box {
  return b !== null && b.width >= MIN_SEEN && b.height >= MIN_SEEN;
}

/** Measure one transition before constructing any of its animations. */
export function measureTransition(
  direction: "open" | "close", card: HTMLElement | null, isReduced: boolean,
  hooks: Pick<MorphOptions, "sheet" | "shared" | "radius"> & { backgroundScaled: boolean },
): Geometry {
  const { sheet, backgroundScaled } = hooks;
  const destinations = sharedElements(sheet);
  const keys = [...destinations.keys()];
  // No cache survives this measurement: React may replace the card or detail
  // between open and Back.
  let sources: Map<string, HTMLElement>;
  // Boxes are measured on screen and used in the sheet's CSS pixels. They
  // differ when an ancestor of the demo is scaled (a preview shrunk to fit).
  const unit = unitOf(sheet.getBoundingClientRect().width, sheet.offsetWidth);
  const rectOf = (el: Element): Box => toLocal(screenRectOf(el), unit);
  const visibleBoxOf = (el: Element): Box | null => {
    const v = screenVisibleBoxOf(el);
    return v ? toLocal(v, unit) : null;
  };

  function isShared(key: string): boolean {
    return !hooks.shared || hooks.shared.includes(key);
  }

  function radiusOf(el: Element, width: number): number {
    return parseRadius(getComputedStyle(el).borderTopLeftRadius, width);
  }

  /**
   * A card picture that is an image or a video is a crop of the large one, at
   * its object-position. A plain box (a gradient, an icon tile) is not.
   */
  function cropOf(el: Element): { align: [number, number]; crop: boolean } {
    const media = /^(img|video|picture|canvas)$/i.test(el.tagName) ? el : el.querySelector("img, video, canvas");
    const pos = media ? getComputedStyle(media).objectPosition : "";
    const part = (v: string | undefined) => {
      if (!v) return 0.5;
      if (v === "left" || v === "top") return 0;
      if (v === "right" || v === "bottom") return 1;
      if (v.endsWith("%")) return Math.min(1, Math.max(0, Number.parseFloat(v) / 100));
      return 0.5;
    };
    const [x, y] = pos.trim().split(/\s+/);
    return { align: [part(x), part(y)], crop: Boolean(media) };
  }

  function pairFor(key: string, card: HTMLElement): PairGeometry {
    sources ??= sharedElements(card);
    const src = sources.get(key) ?? null;
    const dst = destinations.get(key) ?? null;
    const skip = (reason: SkipReason): PairGeometry => ({
      key,
      mode: "skip",
      reason,
      src,
      dst,
      srcBox: ZERO,
      dstBox: ZERO,
      scale: 1,
    });
    if (!isShared(key)) return skip("not-shared");
    if (!src) return skip("missing-card-element");
    if (!dst) return skip("missing-sheet-element");
    const srcBox = rectOf(src);
    const dstBox = rectOf(dst);
    if (area(srcBox) === 0) return skip("missing-card-element");
    if (area(dstBox) === 0) return skip("missing-sheet-element");
    // Never fly to a place the reader cannot see: the copy would end up
    // floating over an unrelated part of the screen. The source may be cut off
    // by the list's edge: the surface starts at the visible part of the card,
    // so a hidden source stays hidden until the growing surface reveals it.
    if (!isOnScreen(dstBox, visibleBoxOf(dst))) return skip("sheet-element-offscreen");
    const declared = dst.getAttribute("data-morph-mode") ?? src.getAttribute("data-morph-mode");
    const mode =
      declared === "box" || declared === "text"
        ? declared
        : /^(img|svg|video|canvas|picture)$/i.test(dst.tagName)
          ? "box"
          : "text";
    const srcStyle = getComputedStyle(src);
    const dstStyle = getComputedStyle(dst);
    const decision = planPair({
      src: srcBox,
      dst: dstBox,
      mode,
      srcFont: Number.parseFloat(srcStyle.fontSize) || 16,
      dstFont: Number.parseFloat(dstStyle.fontSize) || 16,
      srcLines: mode === "text" ? textLines(src, srcBox.height, srcStyle) : 1,
      dstLines: mode === "text" ? textLines(dst, dstBox.height, dstStyle) : 1,
      srcClipped: mode === "text" && isClipped(src, srcStyle),
    });
    return {
      key,
      mode: decision.crossfade ? "crossfade" : "scale",
      src,
      dst,
      srcBox,
      dstBox,
      scale: decision.scale,
      fill:
        decision.crossfade && mode === "box"
          ? { radius: [radiusOf(src, srcBox.width), radiusOf(dst, dstBox.width)], ...cropOf(src) }
          : undefined,
    };
  }

  const sheetBox = rectOf(sheet);
  let reason: SkipReason | undefined;
  let cardBox = ZERO;
  let clipBox = ZERO;
  let shift = NO_SHIFT;
  if (isReduced) reason = "reduced-motion";
  else if (!card || !card.isConnected) reason = "no-card";
  else if (area(sheetBox) === 0) reason = "sheet-hidden";
  else {
    // A press effect (scale on :active) would shrink the measured card.
    settleTransitions(card);
    cardBox = rectOf(card);
    // Never fly from (or back to) a card the reader cannot see at all. A
    // card the reader can click, even one cut off by the edge of the
    // screen or of its list, grows from the part that shows.
    const view = visibleBoxOf(card);
    const shown = view ? intersect(cardBox, view) : null;
    if (!isSeen(shown)) reason = "card-offscreen";
    else {
      // The flight is drawn inside the sheet. A sheet smaller than the
      // screen (a centred panel) may not cover the card: it then starts
      // moved over the card and slides into place while it grows. A
      // transform would drag position: fixed children, so those sheets
      // only use the part of the card under them.
      if (!hasFixedDescendant(sheet)) shift = coverShift(shown, sheetBox);
      const under = intersect(shown as Box, moveBox(sheetBox, shift));
      if (!isSeen(under)) reason = "card-offscreen";
      // The surface starts as the part of the card the reader sees, not the
      // part hidden under a toolbar or the list's edge.
      else clipBox = under;
    }
  }
  const pairs: PairGeometry[] =
    reason || !card
      ? keys.map((key) => ({
          key,
          mode: "skip" as const,
          reason: reason ?? "no-card",
          src: null,
          dst: destinations.get(key) ?? null,
          srcBox: ZERO,
          dstBox: ZERO,
          scale: 1,
        }))
      : keys.map((key) => pairFor(key, card));

  let colors: [string, string] | null = null;
  let border: string | null = null;
  let radius = 0;
  let sheetRadius = 0;
  if (!reason && card) {
    const cardStyle = getComputedStyle(card);
    const sheetStyle = getComputedStyle(sheet);
    const from = cardStyle.backgroundColor;
    const to = sheetStyle.backgroundColor;
    if (from !== to && !TRANSPARENT.test(from) && !TRANSPARENT.test(to)) colors = [from, to];
    if ((Number.parseFloat(cardStyle.borderTopWidth) || 0) > 0 && !TRANSPARENT.test(cardStyle.borderTopColor)) {
      border = cardStyle.borderTopColor;
    }
    radius = hooks.radius ?? parseRadius(cardStyle.borderTopLeftRadius, cardBox.width);
    sheetRadius = parseRadius(sheetStyle.borderTopLeftRadius, sheetBox.width);
  }

  // Everything is drawn inside the sheet, so boxes on the card side are
  // given relative to where the sheet is when it covers the card.
  const back = { x: -shift.x, y: -shift.y };
  if (reason) shift = NO_SHIFT;
  const local = reason ? pairs : pairs.map((p) => (p.mode === "skip" ? p : { ...p, srcBox: moveBox(p.srcBox, back) }));

  return {
    plan: {
      direction,
      choreography: reason ? "fade" : "morph",
      reason,
      reduced: isReduced,
      backgroundScaled: Boolean(backgroundScaled),
      pairs: pairs.map(({ key, mode, reason: why }) => (why ? { key, mode, reason: why } : { key, mode })),
    },
    card: reason ? null : card,
    cardBox: moveBox(cardBox, back),
    clipBox: moveBox(clipBox, back),
    sheetBox,
    shift,
    unit,
    radius,
    sheetRadius,
    colors,
    border,
    pairs: local,
  };
}

export function backgroundOriginFor(background: HTMLElement): string {
  const unit = unitOf(background.getBoundingClientRect().width, background.offsetWidth);
  const visible = screenVisibleBoxOf(background);
  return backgroundOrigin(toLocal(screenRectOf(background), unit), visible ? toLocal(visible, unit) : null);
}
