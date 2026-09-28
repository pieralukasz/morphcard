/**
 * DOM helpers: measuring what is on screen, finding marked elements, and
 * undoing every attribute or inline style the library sets.
 */
import { type Box, intersect, lineCount, toBox, unitOf } from "./geometry";

export const SHARED_ATTR = "data-morph";
export const GHOST_ATTR = "data-morph-ghost";
const STAGGER_ATTR = "data-morph-stagger";
const DOCK_ATTR = "data-morph-dock";

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function viewportBox(): Box {
  const doc = document.documentElement;
  return { left: 0, top: 0, width: doc.clientWidth || window.innerWidth, height: window.innerHeight };
}

/**
 * The part of the viewport where `el` can be seen: the viewport cut down by
 * every ancestor that clips its content (overflow other than visible).
 * Returns null when an ancestor clips everything away.
 */
export function visibleBoxOf(el: Element): Box | null {
  let visible: Box | null = viewportBox();
  for (let node = el.parentElement; node && visible; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) break;
    const style = getComputedStyle(node);
    if (style.display === "contents") continue;
    if (style.overflowX !== "visible" || style.overflowY !== "visible") {
      const rect = node.getBoundingClientRect();
      // Client sizes and borders are in layout pixels; rect and the viewport
      // are in screen pixels. Account for scale on this node or an ancestor
      // before clipping, otherwise a shrunk list includes cards it hides.
      const scaleX = unitOf(rect.width, node.offsetWidth);
      const scaleY = unitOf(rect.height, node.offsetHeight);
      visible = intersect(visible, {
        left: rect.left + node.clientLeft * scaleX,
        top: rect.top + node.clientTop * scaleY,
        width: node.clientWidth * scaleX,
        height: node.clientHeight * scaleY,
      });
    }
    // A fixed ancestor is positioned against the viewport, so clipping by
    // its own ancestors does not apply in the common case.
    if (style.position === "fixed") break;
  }
  return visible;
}

export function rectOf(el: Element): Box {
  return toBox(el.getBoundingClientRect());
}

/**
 * True when a descendant is position: fixed. A transform on the ancestor
 * would become the containing block of that descendant and drag it along.
 */
export function hasFixedDescendant(el: Element): boolean {
  const all = el.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    const node = all[i];
    if (node && getComputedStyle(node).position === "fixed") return true;
  }
  return false;
}

/** The text is cut off: an ellipsis, a line clamp or hidden overflow. */
export function isClipped(el: Element, style = getComputedStyle(el)): boolean {
  if (style.overflowX === "visible" && style.overflowY === "visible") return false;
  if (el.clientWidth === 0) return false;
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
}

export function textLines(el: Element, height: number, style = getComputedStyle(el)): number {
  const fontSize = Number.parseFloat(style.fontSize) || 16;
  const inner =
    height -
    (Number.parseFloat(style.paddingTop) || 0) -
    (Number.parseFloat(style.paddingBottom) || 0) -
    (Number.parseFloat(style.borderTopWidth) || 0) -
    (Number.parseFloat(style.borderBottomWidth) || 0);
  return lineCount(Math.max(0, inner), style.lineHeight, fontSize);
}

/** Index once per measurement; duplicate keys keep the first non-ghost element. */
export function sharedElements(root: Element): Map<string, HTMLElement> {
  const elements = new Map<string, HTMLElement>();
  for (const el of root.querySelectorAll<HTMLElement>(`[${SHARED_ATTR}]`)) {
    if (el.closest(`[${GHOST_ATTR}]`)) continue;
    const key = el.getAttribute(SHARED_ATTR);
    if (key && !elements.has(key)) elements.set(key, el);
  }
  return elements;
}

export interface SheetContent {
  /** Blocks marked data-morph-stagger, in document order. */
  stagger: HTMLElement[];
  /** Unmarked blocks: they fade with the content so they never show through the card. */
  plain: HTMLElement[];
  /** Bars marked data-morph-dock, which slide in from below. */
  docks: HTMLElement[];
}

/**
 * Splits the sheet into the parts that move differently. Walks down only
 * into elements that contain shared, stagger or dock markers, so each
 * returned element is the largest block that can fade as a whole.
 */
export function collectContent(sheet: Element): SheetContent {
  const out: SheetContent = { stagger: [], plain: [], docks: [] };
  const marked = `[${SHARED_ATTR}], [${STAGGER_ATTR}], [${DOCK_ATTR}]`;
  const walk = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (!(child instanceof HTMLElement) && !(child instanceof SVGElement)) continue;
      if (child.hasAttribute(GHOST_ATTR) || child.hasAttribute(SHARED_ATTR)) continue;
      if (child.hasAttribute(DOCK_ATTR)) {
        out.docks.push(child as HTMLElement);
      } else if (child.hasAttribute(STAGGER_ATTR) && !child.querySelector(`[${SHARED_ATTR}]`)) {
        out.stagger.push(child as HTMLElement);
      } else if (child.querySelector(marked)) {
        walk(child);
      } else {
        out.plain.push(child as HTMLElement);
      }
    }
  };
  walk(sheet);
  return out;
}

/** Largest blocks of a card copy that contain no shared element. */
export function collectRest(root: Element): Element[] {
  const out: Element[] = [];
  const walk = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (child.hasAttribute(SHARED_ATTR)) continue;
      if (child.querySelector(`[${SHARED_ATTR}]`)) walk(child);
      else out.push(child);
    }
  };
  walk(root);
  return out;
}

export function focusTargetIn(root: HTMLElement): HTMLElement | null {
  if (root.matches("[data-morph-focus]")) return root;
  const marked = root.querySelector<HTMLElement>("[data-morph-focus]");
  if (marked) return marked;
  if (root.matches(FOCUSABLE)) return root;
  const first = root.querySelector<HTMLElement>(FOCUSABLE);
  if (first) return first;
  return root.tabIndex >= 0 ? root : null;
}

export type Scroller = HTMLElement | Window;

/** Nearest ancestor that scrolls vertically, or the window. */
export function scrollerOf(el: Element): Scroller {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) break;
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll" || overflow === "overlay") && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return window;
}

export interface SavedScroll {
  target: Scroller;
  top: number;
  left: number;
}

export function saveScroll(target: Scroller): SavedScroll {
  if (target instanceof Window) return { target, top: window.scrollY, left: window.scrollX };
  return { target, top: target.scrollTop, left: target.scrollLeft };
}

/** Puts the scroll position back at once, ignoring scroll-behavior: smooth. */
export function restoreScroll(saved: SavedScroll): void {
  const { target, top, left } = saved;
  if (target instanceof Window) {
    if (window.scrollY !== top || window.scrollX !== left) window.scrollTo({ top, left, behavior: "instant" });
  } else if (target.isConnected && (target.scrollTop !== top || target.scrollLeft !== left)) {
    target.scrollTo({ top, left, behavior: "instant" });
  }
}

/**
 * Records every attribute it changes and puts them back in reverse order, so
 * nothing the library touched survives a cleanup.
 */
export class Undo {
  private steps: Array<() => void> = [];

  attr(el: Element, name: string, value: string | null): void {
    const previous = el.getAttribute(name);
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
    this.steps.push(() => {
      if (previous === null) el.removeAttribute(name);
      else el.setAttribute(name, previous);
    });
  }

  get size(): number {
    return this.steps.length;
  }

  flush(): void {
    for (let step = this.steps.pop(); step; step = this.steps.pop()) step();
  }
}
