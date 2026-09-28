/**
 * Pure geometry and decision helpers. Nothing here touches the DOM, so every
 * rule that decides how an element moves can be unit tested.
 */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function box(left: number, top: number, width: number, height: number): Box {
  return { left, top, width, height };
}

export function toBox(rect: { left: number; top: number; width: number; height: number }): Box {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/**
 * Screen pixels per CSS pixel of an element: its rendered width over its
 * layout width. Not 1 when an ancestor is scaled (a preview frame shrunk to
 * fit, a zoomed canvas). Falls back to 1 when either size is unusable.
 */
export function unitOf(rendered: number, layout: number): number {
  if (!(rendered > 0) || !(layout > 0)) return 1;
  const unit = rendered / layout;
  return Math.abs(unit - 1) < 0.001 ? 1 : unit;
}

/**
 * A box measured on screen, in the CSS pixels of a scaled subtree. Clip
 * insets and transforms are written in those pixels, so every measured box
 * goes through this before it becomes a keyframe.
 */
export function toLocal(b: Box, unit: number): Box {
  if (unit === 1) return b;
  return { left: b.left / unit, top: b.top / unit, width: b.width / unit, height: b.height / unit };
}

export function area(b: Box | null): number {
  return b ? Math.max(0, b.width) * Math.max(0, b.height) : 0;
}

/** The overlap of two boxes, or null when they do not overlap. */
export function intersect(a: Box, b: Box): Box | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  if (right <= left || bottom <= top) return null;
  return { left, top, width: right - left, height: bottom - top };
}

/** Share of `rect` that is inside `visible` (0 to 1). Empty boxes count as hidden. */
export function visibleRatio(rect: Box, visible: Box | null): number {
  const whole = area(rect);
  if (whole <= 0 || !visible) return 0;
  return area(intersect(rect, visible)) / whole;
}

/** Below this share of their area on screen, elements do not take part in a flight. */
export const MIN_VISIBLE = 0.5;

export function isOnScreen(rect: Box, visible: Box | null, min = MIN_VISIBLE): boolean {
  return visibleRatio(rect, visible) >= min;
}

function px(n: number): string {
  // Round to 0.01px so keyframes stay readable and stable in tests.
  return `${Math.round(n * 100) / 100}px`;
}

/**
 * A clip-path that shows only `rect` of an element whose border box is
 * `container`. The rect is clamped to the container, so a card that sticks
 * out of the surface never produces negative insets.
 */
export function insetClip(rect: Box, container: Box, radius: number): string {
  const top = Math.max(0, rect.top - container.top);
  const left = Math.max(0, rect.left - container.left);
  const right = Math.max(0, container.left + container.width - (rect.left + rect.width));
  const bottom = Math.max(0, container.top + container.height - (rect.top + rect.height));
  return `inset(${px(top)} ${px(right)} ${px(bottom)} ${px(left)} round ${px(radius)})`;
}

export function fullClip(radius: number): string {
  return `inset(0px 0px 0px 0px round ${px(radius)})`;
}

/**
 * First length of a computed border-radius ("16px", "16px 8px"). Percentages
 * resolve against `width`; anything else counts as square.
 */
export function parseRadius(value: string | null | undefined, width = 0): number {
  const text = value?.trim() ?? "";
  const pxMatch = /^(\d*\.?\d+)px/.exec(text);
  if (pxMatch) return Number(pxMatch[1]);
  const pctMatch = /^(\d*\.?\d+)%/.exec(text);
  if (pctMatch) return (Number(pctMatch[1]) / 100) * width;
  return 0;
}

/** Lines of text in a box, given its computed line-height and font-size. */
export function lineCount(height: number, lineHeight: string, fontSize: number): number {
  const parsed = Number.parseFloat(lineHeight);
  // "normal" does not parse; browsers use roughly 1.2 for common fonts.
  const lh = Number.isFinite(parsed) && parsed > 0 ? (lineHeight.endsWith("px") ? parsed : parsed * fontSize) : fontSize * 1.2;
  if (lh <= 0) return 1;
  return Math.max(1, Math.round(height / lh));
}

export interface PairInput {
  /** Source box on the card. */
  src: Box;
  /** Destination box on the detail screen. */
  dst: Box;
  /** "text" scales by font size, "box" (images, icons) by width. */
  mode: "text" | "box";
  srcFont?: number;
  dstFont?: number;
  srcLines?: number;
  dstLines?: number;
  /** The source text is cut off (ellipsis or overflow). */
  srcClipped?: boolean;
}

export interface PairPlan {
  /** Uniform scale that turns the destination into the source. */
  scale: number;
  /**
   * True when one scaled copy cannot stand in for the other: the text wraps
   * differently, is cut off on the card, or the box proportions differ. Then
   * both copies fly together and crossfade instead of one copy stretching.
   */
  crossfade: boolean;
}

/** How far the width or height ratio may drift from the scale before we crossfade. */
export const ASPECT_TOLERANCE = 0.04;

export function planPair(input: PairInput): PairPlan {
  const { src, dst } = input;
  if (input.mode === "box") {
    const scale = dst.width > 0 ? src.width / dst.width : 1;
    const crossfade = dst.height <= 0 || Math.abs(src.height / dst.height - scale) > ASPECT_TOLERANCE;
    return { scale, crossfade };
  }
  const srcFont = input.srcFont ?? 16;
  const dstFont = input.dstFont ?? 16;
  const scale = dstFont > 0 ? srcFont / dstFont : 1;
  const crossfade =
    Boolean(input.srcClipped) ||
    (input.srcLines ?? 1) !== (input.dstLines ?? 1) ||
    dst.width <= 0 ||
    dst.height <= 0 ||
    Math.abs(src.width / dst.width - scale) > ASPECT_TOLERANCE ||
    Math.abs(src.height / dst.height - scale) > ASPECT_TOLERANCE;
  return { scale, crossfade };
}

/** Transform (origin 0 0) that draws an element laid out at `at` over `over`, scaled by `scale`. */
export function placeOver(at: Box, over: Box, scale: number): string {
  return `translate(${px(over.left - at.left)}, ${px(over.top - at.top)}) scale(${Math.round(scale * 10000) / 10000})`;
}

/**
 * Transform origin for scaling the background back: the horizontal centre of
 * its visible part and 30% down it, so a long scrolled page shrinks around
 * what the reader sees, not around the middle of the whole document.
 */
export function backgroundOrigin(element: Box, visible: Box | null): string {
  const v = visible ?? element;
  const x = v.left + v.width / 2 - element.left;
  const y = v.top + v.height * 0.3 - element.top;
  return `${px(x)} ${px(y)}`;
}
