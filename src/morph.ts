/**
 * createMorph: a card that grows into a full detail sheet and shrinks back.
 *
 * The sheet is one surface whose clip-path starts as the card's shape. Shared
 * elements (data-morph="key") fly from the card to their place on the sheet.
 * Everything else fades or slides. All motion uses the Web Animations API, so
 * a close that arrives mid-open reverses the running animations from where
 * they are instead of jumping.
 */
import {
  type Box,
  area,
  backgroundOrigin,
  fullClip,
  fillFrames,
  insetClip,
  intersect,
  isOnScreen,
  parseRadius,
  placeOver,
  planPair,
  toLocal,
  unitOf,
} from "./geometry";
import {
  FOCUSABLE,
  GHOST_ATTR,
  SHARED_ATTR,
  type SavedScroll,
  type Scroller,
  Undo,
  collectContent,
  collectRest,
  findShared,
  focusTargetIn,
  fontSizeOf,
  hasFixedDescendant,
  isClipped,
  rectOf as screenRectOf,
  restoreScroll,
  saveScroll,
  scrollerOf,
  sharedKeys,
  textLines,
  visibleBoxOf as screenVisibleBoxOf,
} from "./dom";

export type MorphState = "closed" | "opening" | "open" | "closing";

/** Why a shared element (or the whole card) did not fly. */
export type SkipReason =
  | "reduced-motion"
  | "no-card"
  | "card-offscreen"
  | "sheet-hidden"
  | "not-shared"
  | "missing-card-element"
  | "missing-sheet-element"
  | "sheet-element-offscreen";

export interface PairReport {
  key: string;
  /** scale: one copy flies and scales. crossfade: both copies fly and swap. skip: no flight. */
  mode: "scale" | "crossfade" | "skip";
  reason?: SkipReason;
}

/** What the last transition decided. Handy when a flight did not happen. */
export interface MorphPlan {
  direction: "open" | "close";
  /** morph: the surface grows from the card. fade: opacity only, no flight. */
  choreography: "morph" | "fade";
  reason?: SkipReason;
  reduced: boolean;
  backgroundScaled: boolean;
  pairs: PairReport[];
}

export interface MorphTiming {
  /** Milliseconds. Closing is shorter: the user already knows where they are going back to. */
  duration: { open: number; close: number };
  /** surface: clip-path, shared flights and background. content: stagger and dock. */
  easing: { surface: string; content: string };
  /** Delay between staggered content blocks, in milliseconds. */
  stagger: number;
  /** Scale of the background while the sheet is open. false keeps it still. */
  backgroundScale: number | false;
  /** "system" follows prefers-reduced-motion; true or false forces it. */
  reducedMotion: "system" | boolean;
  /** Multiplies every duration and delay. 4 plays everything four times slower. */
  timeScale: number;
  closeOnEscape: boolean;
  /** Put the list's scroll position back before measuring the card on close. */
  restoreScroll: boolean;
}

export interface MorphOptions extends Partial<Omit<MorphTiming, "duration" | "easing">> {
  /** The detail surface. Positioned (fixed or absolute) and hidden while closed. */
  sheet: HTMLElement;
  /** What recedes behind the sheet. Must not contain the sheet. */
  background?: HTMLElement | null;
  /** Dims the background. Shown while the sheet is visible. */
  scrim?: HTMLElement | null;
  duration?: Partial<MorphTiming["duration"]>;
  easing?: Partial<MorphTiming["easing"]>;
  /** Keys allowed to fly. Default: every data-morph key. Others fade in place. */
  shared?: string[];
  /** Corner radius of the card in px. Default: the card's computed border radius. */
  radius?: number;
  /** Scroll container of the list. Default: nearest scrolling ancestor of the card, or the window. */
  scroller?: Scroller;
  /** Fill the sheet for this card. Runs before anything is measured; may return a promise. */
  prepare?: (card: HTMLElement | null) => void | Promise<void>;
  onStateChange?: (state: MorphState, card: HTMLElement | null) => void;
  /**
   * Where a close without `to` lands. Receives the card the sheet opened
   * from. Lets a caller follow a card that was re-rendered while the sheet
   * was open. Default: that same card.
   */
  resolveCard?: (card: HTMLElement | null) => HTMLElement | null;
}

export interface CloseOptions {
  /**
   * The element to return to. Pass a new element when the list re-rendered,
   * or null when there is nothing to return to (the sheet then fades out).
   */
  to?: HTMLElement | null;
}

export interface Morph {
  /** Opens the sheet from `card`. null opens without a flight (deep link). Resolves true once open. */
  open(card?: HTMLElement | null): Promise<boolean>;
  /** Closes back to the card. Resolves true once closed. */
  close(options?: CloseOptions): Promise<boolean>;
  readonly state: MorphState;
  /** The card the sheet belongs to, or null. */
  readonly card: HTMLElement | null;
  /** The decision taken by the latest transition. */
  readonly plan: MorphPlan | null;
  /** Changes timing and callbacks for the next transition. */
  setOptions(options: Partial<Omit<MorphOptions, "sheet" | "background" | "scrim">>): void;
  /** Stops any transition, restores the page and removes listeners. */
  destroy(): void;
}

export const defaults: MorphTiming = {
  duration: { open: 400, close: 300 },
  easing: {
    surface: "cubic-bezier(0.32, 0.72, 0, 1)",
    content: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
  stagger: 45,
  backgroundScale: 0.96,
  reducedMotion: "system",
  timeScale: 1,
  closeOnEscape: true,
  restoreScroll: true,
};

/**
 * Fractions of the open or close duration. With the defaults (400 / 300 ms):
 * content enters at 130 ms, the card copy of a crossfading text is gone by
 * 160 ms, and on close the big heading hands over to the card text by 90 ms.
 */
export const choreography = {
  open: {
    contentDelay: 0.325,
    content: 0.65,
    copyOut: 0.4,
    targetIn: 0.5,
    restOut: 0.35,
    borderOut: 0.2,
    lateIn: 0.4,
    dockDelay: 0.4,
    dock: 0.75,
  },
  close: { copyIn: 0.37, targetOut: 0.3, restDelay: 0.5, rest: 0.5, contentOut: 0.37, dock: 0.6 },
  /** Opacity only, in ms: the empty surface covers the page before any text appears. */
  fade: { surface: 120, contentDelay: 100, content: 140, closeContent: 100, closeSurfaceDelay: 100, closeSurface: 120 },
} as const;

const EASE_OUT = "ease-out";
const TRANSPARENT = /^(transparent|rgba\(0, 0, 0, 0\))$/;

interface Run {
  kind: "open" | "close";
  /** 1 plays the run as built, -1 plays it backwards. */
  dir: 1 | -1;
  anims: Animation[];
  ghosts: HTMLElement[];
}

interface PairGeometry extends PairReport {
  src: HTMLElement | null;
  dst: HTMLElement | null;
  srcBox: Box;
  dstBox: Box;
  scale: number;
  /**
   * A picture that changes shape on the way (a crossfading box): corner
   * radii [card, sheet] and where the card's crop sits in the large picture.
   * Both copies then show one picture in one moving frame.
   */
  fill?: { radius: [number, number]; align: [number, number]; crop: boolean };
}

interface Geometry {
  plan: MorphPlan;
  card: HTMLElement | null;
  cardBox: Box;
  /** The visible part of the card: where the surface starts and ends. */
  clipBox: Box;
  sheetBox: Box;
  /** Screen pixels per CSS pixel of the sheet; boxes above are in CSS pixels. */
  unit: number;
  radius: number;
  sheetRadius: number;
  colors: [string, string] | null;
  border: string | null;
  pairs: PairGeometry[];
}

interface Session {
  scroll: SavedScroll | null;
  scaled: boolean;
  origin: string;
}

const ZERO: Box = { left: 0, top: 0, width: 0, height: 0 };

/** Jumps CSS transitions on the card (hover, press) to their end so the card is measured at rest. */
function settleTransitions(card: HTMLElement) {
  if (typeof card.getAnimations !== "function") return;
  for (const a of card.getAnimations({ subtree: true })) {
    if (typeof CSSTransition !== "undefined" && a instanceof CSSTransition) a.finish();
  }
}

function within(visible: Box | null, bounds: Box): Box | null {
  return visible ? intersect(visible, bounds) : null;
}

export function resolveTiming(options: Partial<MorphOptions>, base: MorphTiming): MorphTiming {
  return {
    duration: { ...base.duration, ...options.duration },
    easing: { ...base.easing, ...options.easing },
    stagger: options.stagger ?? base.stagger,
    backgroundScale: options.backgroundScale ?? base.backgroundScale,
    reducedMotion: options.reducedMotion ?? base.reducedMotion,
    timeScale: options.timeScale ?? base.timeScale,
    closeOnEscape: options.closeOnEscape ?? base.closeOnEscape,
    restoreScroll: options.restoreScroll ?? base.restoreScroll,
  };
}

function time(a: Animation): number {
  return Number(a.currentTime ?? 0);
}

export function createMorph(options: MorphOptions): Morph {
  const sheet = options.sheet;
  if (!sheet) throw new TypeError("morphcard: the `sheet` option is required");
  const background = options.background ?? null;
  const scrim = options.scrim ?? null;
  if (background && (background.contains(sheet) || background === scrim)) {
    // It would scale and make inert the sheet itself.
    throw new TypeError("morphcard: `background` must not contain the sheet");
  }
  if (scrim?.contains(sheet)) throw new TypeError("morphcard: `scrim` must not contain the sheet");
  // Closed means hidden: the library shows the sheet only while it is used.
  sheet.hidden = true;
  if (scrim) scrim.hidden = true;
  for (const el of [sheet, scrim]) {
    if (el?.isConnected && getComputedStyle(el).display !== "none") {
      console.warn(
        "morphcard: an element with the hidden attribute is still displayed. A display rule in your CSS overrides [hidden]; add `[hidden] { display: none !important }`.",
        el,
      );
    }
  }

  let timing = resolveTiming(options, defaults);
  let hooks = {
    prepare: options.prepare,
    onStateChange: options.onStateChange,
    shared: options.shared,
    radius: options.radius,
    scroller: options.scroller,
    resolveCard: options.resolveCard,
  };

  let state: MorphState = "closed";
  let current: HTMLElement | null = null;
  let returnTo: HTMLElement | null = null;
  let gen = 0;
  let run: Run | null = null;
  let holds: Animation[] = [];
  let session: Session | null = null;
  let plan: MorphPlan | null = null;
  let lockTimer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;
  const waiters = new Set<{ target: "open" | "closed"; resolve: (reached: boolean) => void }>();
  // inert on the sheet and scrim while they move: undone at the end of every run.
  const runUndo = new Undo();
  // inert on the background: undone as soon as a close starts.
  const inertUndo = new Undo();
  // Anything else kept while the sheet is shown (tabindex on the sheet).
  const sessionUndo = new Undo();

  const reduced = () =>
    timing.reducedMotion === "system"
      ? typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
      : timing.reducedMotion;

  function setState(next: MorphState) {
    if (state === next) return;
    state = next;
    if (next === "closed") sheet.removeAttribute("data-morph-state");
    else sheet.setAttribute("data-morph-state", next);
    hooks.onStateChange?.(next, current);
  }

  function wait(target: "open" | "closed"): Promise<boolean> {
    return new Promise((resolve) => waiters.add({ target, resolve }));
  }

  function resolveWaiters(reached: "open" | "closed") {
    for (const waiter of waiters) waiter.resolve(waiter.target === reached);
    waiters.clear();
  }

  // ---------------------------------------------------------------- measure

  // Boxes are measured on screen and used in the sheet's CSS pixels. They
  // differ when an ancestor of the demo is scaled (a preview shrunk to fit).
  let unit = 1;
  const rectOf = (el: Element): Box => toLocal(screenRectOf(el), unit);
  const visibleBoxOf = (el: Element): Box | null => {
    const v = screenVisibleBoxOf(el);
    return v ? toLocal(v, unit) : null;
  };
  const measureUnit = (el: HTMLElement) => unitOf(el.getBoundingClientRect().width, el.offsetWidth);

  function keys(): string[] {
    return sharedKeys(sheet);
  }

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
    const src = findShared(card, key);
    const dst = findShared(sheet, key);
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
    const decision = planPair({
      src: srcBox,
      dst: dstBox,
      mode,
      srcFont: fontSizeOf(src),
      dstFont: fontSizeOf(dst),
      srcLines: mode === "text" ? textLines(src, srcBox.height) : 1,
      dstLines: mode === "text" ? textLines(dst, dstBox.height) : 1,
      srcClipped: mode === "text" && isClipped(src),
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

  function measure(direction: "open" | "close", card: HTMLElement | null, isReduced: boolean): Geometry {
    unit = measureUnit(sheet);
    const sheetBox = rectOf(sheet);
    let reason: SkipReason | undefined;
    let cardBox = ZERO;
    let clipBox = ZERO;
    if (isReduced) reason = "reduced-motion";
    else if (!card || !card.isConnected) reason = "no-card";
    else if (area(sheetBox) === 0) reason = "sheet-hidden";
    else {
      // A press effect (scale on :active) would shrink the measured card.
      settleTransitions(card);
      cardBox = rectOf(card);
      // Never fly from (or back to) a card the reader cannot see. The flight
      // is drawn inside the sheet, so only the part of the card under it counts.
      const seen = within(visibleBoxOf(card), sheetBox);
      if (!isOnScreen(cardBox, seen)) reason = "card-offscreen";
      // The surface starts as the part of the card the reader sees, not the
      // part hidden under a toolbar or the list's edge.
      else clipBox = intersect(cardBox, seen as Box) ?? cardBox;
    }
    const pairs: PairGeometry[] =
      reason || !card
        ? keys().map((key) => ({
            key,
            mode: "skip" as const,
            reason: reason ?? "no-card",
            src: null,
            dst: findShared(sheet, key),
            srcBox: ZERO,
            dstBox: ZERO,
            scale: 1,
          }))
        : keys().map((key) => pairFor(key, card));

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

    return {
      plan: {
        direction,
        choreography: reason ? "fade" : "morph",
        reason,
        reduced: isReduced,
        backgroundScaled: Boolean(session?.scaled),
        pairs: pairs.map(({ key, mode, reason: why }) => (why ? { key, mode, reason: why } : { key, mode })),
      },
      card: reason ? null : card,
      cardBox,
      clipBox,
      sheetBox,
      unit,
      radius,
      sheetRadius,
      colors,
      border,
      pairs,
    };
  }

  // ------------------------------------------------------------------ build

  function play(r: Run, el: Element, frames: Keyframe[], duration: number, delay = 0, easing = "linear") {
    const a = el.animate(frames, { duration: Math.max(0, duration), delay, easing, fill: "both" });
    r.anims.push(a);
    return a;
  }

  /**
   * A copy of the card placed exactly over it, inside the sheet. It carries
   * what the sheet does not have (meta lines, icons, the border) and the
   * card's own version of texts that crossfade.
   */
  function makeGhost(r: Run, g: Geometry) {
    const card = g.card as HTMLElement;
    const ghost = card.cloneNode(true) as HTMLElement;
    ghost.removeAttribute("id");
    for (const node of ghost.querySelectorAll("[id]")) node.removeAttribute("id");
    // A cloned radio with the same name would uncheck the original.
    for (const node of ghost.querySelectorAll("[name]")) node.removeAttribute("name");
    ghost.setAttribute(GHOST_ATTR, "");
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    const style = getComputedStyle(card);
    // Inherited text styles come from the list, not from the sheet.
    for (const prop of [
      "color",
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "line-height",
      "letter-spacing",
      "text-align",
      "white-space",
      "direction",
      "font-feature-settings",
      "font-variant-numeric",
    ]) {
      ghost.style.setProperty(prop, style.getPropertyValue(prop));
    }
    const left = g.cardBox.left - g.sheetBox.left - sheet.clientLeft + sheet.scrollLeft;
    const top = g.cardBox.top - g.sheetBox.top - sheet.clientTop + sheet.scrollTop;
    Object.assign(ghost.style, {
      position: "absolute",
      boxSizing: "border-box",
      margin: "0",
      left: `${left}px`,
      top: `${top}px`,
      width: `${g.cardBox.width}px`,
      height: `${g.cardBox.height}px`,
      minWidth: "0",
      maxWidth: "none",
      minHeight: "0",
      maxHeight: "none",
      background: "transparent",
      boxShadow: "none",
      outline: "none",
      transform: "none",
      transition: "none",
      animation: "none",
      opacity: "1",
      visibility: "visible",
      pointerEvents: "none",
      zIndex: "2147483000",
    });
    ghost.style.borderColor = g.border ?? "transparent";

    const copies = new Map<string, HTMLElement>();
    const rest: Element[] = collectRest(ghost);
    for (const node of ghost.querySelectorAll<HTMLElement>(`[${SHARED_ATTR}]`)) {
      const key = node.getAttribute(SHARED_ATTR) ?? "";
      const pair = g.pairs.find((p) => p.key === key);
      if (pair?.mode === "scale") node.style.visibility = "hidden";
      else if (pair?.mode === "crossfade") copies.set(key, node);
      // Not flying (skipped or not in `shared`): it fades in place like the rest of the card.
      else rest.push(node);
    }
    sheet.appendChild(ghost);
    r.ghosts.push(ghost);
    // Correct for borders, scroll offsets or an unexpected containing block.
    const placed = toLocal(screenRectOf(ghost), g.unit);
    const dx = g.cardBox.left - placed.left;
    const dy = g.cardBox.top - placed.top;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      ghost.style.left = `${left + dx}px`;
      ghost.style.top = `${top + dy}px`;
    }
    return { root: ghost, copies, rest };
  }

  function recede(r: Run, duration: number, back: boolean, isReduced: boolean) {
    if (background && session?.scaled && !isReduced) {
      const still = { transform: "none", transformOrigin: session.origin };
      const away = { transform: `scale(${timing.backgroundScale})`, transformOrigin: session.origin };
      play(r, background, back ? [away, still] : [still, away], duration, 0, timing.easing.surface);
    }
    if (scrim) play(r, scrim, back ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], duration, 0, EASE_OUT);
  }

  function fillOf(p: PairGeometry, direction: "open" | "close") {
    const f = p.fill ?? { radius: [0, 0] as [number, number], align: [0.5, 0.5] as [number, number], crop: true };
    const open = direction === "open";
    return fillFrames({
      big: p.dstBox,
      small: p.srcBox,
      from: open ? p.srcBox : p.dstBox,
      to: open ? p.dstBox : p.srcBox,
      align: f.align,
      crop: f.crop,
      radius: open ? f.radius : [f.radius[1], f.radius[0]],
    });
  }

  function buildOpen(r: Run, g: Geometry) {
    const D = timing.duration.open * timing.timeScale;
    const k = choreography.open;
    const surface = timing.easing.surface;
    const content = timing.easing.content;

    play(r, sheet, [{ clipPath: insetClip(g.clipBox, g.sheetBox, g.radius) }, { clipPath: fullClip(g.sheetRadius) }], D, 0, surface);
    if (g.colors) play(r, sheet, [{ backgroundColor: g.colors[0] }, { backgroundColor: g.colors[1] }], D, 0, surface);

    const ghost = makeGhost(r, g);
    for (const p of g.pairs) {
      if (p.mode === "skip" || !p.dst) {
        // Nothing to fly from: appear once the flights around it have landed.
        if (p.dst) play(r, p.dst, [{ opacity: 0 }, { opacity: 1 }], k.lateIn * D, (1 - k.lateIn) * D, EASE_OUT);
        continue;
      }
      play(
        r,
        p.dst,
        p.fill
          ? fillOf(p, "open").big
          : [
              { transform: placeOver(p.dstBox, p.srcBox, p.scale), transformOrigin: "0 0" },
              { transform: "none", transformOrigin: "0 0" },
            ],
        D,
        0,
        surface,
      );
      if (p.mode !== "crossfade") continue;
      const copy = ghost.copies.get(p.key);
      if (copy) {
        play(
          r,
          copy,
          p.fill
            ? fillOf(p, "open").small
            : [
                { transform: "none", transformOrigin: "0 0" },
                { transform: placeOver(p.srcBox, p.dstBox, 1 / p.scale), transformOrigin: "0 0" },
              ],
          D,
          0,
          surface,
        );
        play(r, copy, [{ opacity: 1 }, { opacity: 0 }], k.copyOut * D, 0, EASE_OUT);
      }
      play(r, p.dst, [{ opacity: 0 }, { opacity: 1 }], k.targetIn * D, 0, EASE_OUT);
    }
    for (const el of ghost.rest) play(r, el, [{ opacity: 1 }, { opacity: 0 }], k.restOut * D, 0, EASE_OUT);
    if (g.border) play(r, ghost.root, [{ borderColor: g.border }, { borderColor: "transparent" }], k.borderOut * D, 0, EASE_OUT);

    const parts = collectContent(sheet);
    parts.stagger.forEach((el, i) => {
      const frames = hasFixedDescendant(el)
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "none" },
          ];
      play(r, el, frames, k.content * D, (k.contentDelay * timing.duration.open + i * timing.stagger) * timing.timeScale, content);
    });
    for (const el of parts.plain) play(r, el, [{ opacity: 0 }, { opacity: 1 }], k.content * D, k.contentDelay * D, content);
    for (const el of parts.docks) {
      const frames = hasFixedDescendant(el)
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ transform: "translateY(100%)" }, { transform: "none" }];
      play(r, el, frames, k.dock * D, k.dockDelay * D, content);
    }

    recede(r, D, false, false);
  }

  function buildClose(r: Run, g: Geometry) {
    const C = timing.duration.close * timing.timeScale;
    const k = choreography.close;
    const surface = timing.easing.surface;

    play(r, sheet, [{ clipPath: fullClip(g.sheetRadius) }, { clipPath: insetClip(g.clipBox, g.sheetBox, g.radius) }], C, 0, surface);
    if (g.colors) play(r, sheet, [{ backgroundColor: g.colors[1] }, { backgroundColor: g.colors[0] }], C, 0, surface);

    const ghost = makeGhost(r, g);
    let anchor: PairGeometry | null = null;
    for (const p of g.pairs) {
      if (p.mode === "skip" || !p.dst) {
        if (p.dst) play(r, p.dst, [{ opacity: 1 }, { opacity: 0 }], k.contentOut * C, 0, EASE_OUT);
        continue;
      }
      if (!anchor || p.dstBox.top + p.dstBox.height > anchor.dstBox.top + anchor.dstBox.height) anchor = p;
      play(
        r,
        p.dst,
        p.fill
          ? fillOf(p, "close").big
          : [
              { transform: "none", transformOrigin: "0 0" },
              { transform: placeOver(p.dstBox, p.srcBox, p.scale), transformOrigin: "0 0" },
            ],
        C,
        0,
        surface,
      );
      if (p.mode !== "crossfade") continue;
      // The texts wrap differently: swap them at the start, while the heading
      // still has room, so the card's own text is what lands on the card.
      const copy = ghost.copies.get(p.key);
      if (copy) {
        play(
          r,
          copy,
          p.fill
            ? fillOf(p, "close").small
            : [
                { transform: placeOver(p.srcBox, p.dstBox, 1 / p.scale), transformOrigin: "0 0" },
                { transform: "none", transformOrigin: "0 0" },
              ],
          C,
          0,
          surface,
        );
        play(r, copy, [{ opacity: 0 }, { opacity: 1 }], k.copyIn * C, 0, EASE_OUT);
      }
      play(r, p.dst, [{ opacity: 1 }, { opacity: 0 }], k.targetOut * C, 0, EASE_OUT);
    }
    // The rest of the card comes back at the end, finishing with everything else.
    for (const el of ghost.rest) play(r, el, [{ opacity: 0 }, { opacity: 1 }], k.rest * C, k.restDelay * C, EASE_OUT);
    if (g.border) play(r, ghost.root, [{ borderColor: "transparent" }, { borderColor: g.border }], k.rest * C, k.restDelay * C, EASE_OUT);

    // Content follows the lowest flying element down into the card and fades.
    const parts = collectContent(sheet);
    const follow = anchor
      ? `translate(${anchor.srcBox.left - anchor.dstBox.left}px, ${anchor.srcBox.top - anchor.dstBox.top}px)`
      : null;
    for (const el of parts.stagger) {
      if (follow && !hasFixedDescendant(el)) play(r, el, [{ transform: "none" }, { transform: follow }], C, 0, surface);
      play(r, el, [{ opacity: 1 }, { opacity: 0 }], k.contentOut * C, 0, EASE_OUT);
    }
    for (const el of parts.plain) play(r, el, [{ opacity: 1 }, { opacity: 0 }], k.contentOut * C, 0, EASE_OUT);
    for (const el of parts.docks) {
      const frames = hasFixedDescendant(el)
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [{ transform: "none" }, { transform: "translateY(100%)" }];
      play(r, el, frames, k.dock * C, 0, EASE_OUT);
    }

    recede(r, C, true, false);
  }

  function sheetChildren(): Element[] {
    return Array.from(sheet.children).filter((el) => !el.hasAttribute(GHOST_ATTR));
  }

  /** Opacity only: the empty surface first, then the content, so two screens of text never overlap. */
  function buildFadeOpen(r: Run, isReduced: boolean) {
    const f = choreography.fade;
    const t = timing.timeScale;
    play(r, sheet, [{ opacity: 0 }, { opacity: 1 }], f.surface * t, 0, "ease");
    for (const el of sheetChildren()) play(r, el, [{ opacity: 0 }, { opacity: 1 }], f.content * t, f.contentDelay * t, "ease");
    recede(r, (f.contentDelay + f.content) * t, false, isReduced);
  }

  function buildFadeClose(r: Run, isReduced: boolean) {
    const f = choreography.fade;
    const t = timing.timeScale;
    for (const el of sheetChildren()) play(r, el, [{ opacity: 1 }, { opacity: 0 }], f.closeContent * t, 0, "ease");
    play(r, sheet, [{ opacity: 1 }, { opacity: 0 }], f.closeSurface * t, f.closeSurfaceDelay * t, "ease");
    recede(r, (f.closeSurfaceDelay + f.closeSurface) * t, true, isReduced);
  }

  // ------------------------------------------------------------- lifecycle

  function applyHolds() {
    cancelHolds();
    const hold = (el: Element, frame: Keyframe) => holds.push(el.animate([frame, frame], { duration: 0, fill: "forwards" }));
    if (background && session?.scaled && !reduced()) {
      hold(background, { transform: `scale(${timing.backgroundScale})`, transformOrigin: session.origin });
    }
    if (scrim) hold(scrim, { opacity: 1 });
  }

  function cancelHolds() {
    for (const a of holds) a.cancel();
    holds = [];
  }

  /**
   * inert while the surface moves: clicks pass through to the page below (so
   * a card can be clicked again mid-close) and nothing inside takes focus.
   * An attribute, not an inline style, so nothing lingers after cleanup.
   */
  function lock(ms?: number) {
    if (!sheet.inert) runUndo.attr(sheet, "inert", "");
    if (scrim && !scrim.inert) runUndo.attr(scrim, "inert", "");
    clearTimeout(lockTimer);
    if (ms !== undefined) {
      const owner = run;
      lockTimer = setTimeout(() => {
        if (run === owner) runUndo.flush();
      }, ms);
    }
  }

  function unlock() {
    clearTimeout(lockTimer);
    runUndo.flush();
  }

  /** Keeps clicks and keys off the page behind while the sheet opens and stays open. */
  function shield() {
    if (background && !background.inert && inertUndo.size === 0) inertUndo.attr(background, "inert", "");
  }

  function focusIn() {
    const target = sheet.querySelector<HTMLElement>("[data-morph-focus]") ?? sheet.querySelector<HTMLElement>(FOCUSABLE);
    if (target && !target.closest(`[${GHOST_ATTR}]`)) {
      target.focus({ preventScroll: true });
      return;
    }
    if (!sheet.hasAttribute("tabindex")) sessionUndo.attr(sheet, "tabindex", "-1");
    sheet.focus({ preventScroll: true });
  }

  function focusOut() {
    const active = document.activeElement;
    const lost = !active || active === document.body || sheet.contains(active);
    // preventScroll: focusing must not undo the restored scroll position.
    if (lost && returnTo?.isConnected) returnTo.focus({ preventScroll: true });
  }

  function watch(r: Run) {
    const owner = gen;
    Promise.allSettled(r.anims.map((a) => a.finished)).then(() => {
      // A newer transition owns the state now; leave it alone.
      if (owner !== gen || run !== r) return;
      settle(reachedBy(r));
    });
  }

  function reachedBy(r: Run): "open" | "closed" {
    return (r.kind === "open") === (r.dir === 1) ? "open" : "closed";
  }

  function settle(target: "open" | "closed") {
    const r = run;
    run = null;
    if (r) {
      for (const a of r.anims) a.cancel();
      for (const ghost of r.ghosts) ghost.remove();
    }
    unlock();
    if (target === "open") {
      applyHolds();
      shield();
      focusIn();
      setState("open");
    } else {
      cancelHolds();
      inertUndo.flush();
      focusOut();
      sessionUndo.flush();
      sheet.hidden = true;
      if (scrim) scrim.hidden = true;
      setState("closed");
      current = null;
      returnTo = null;
      session = null;
    }
    resolveWaiters(target);
  }

  /** Plays the current run the other way from where it is now. */
  function flip(r: Run) {
    gen++;
    r.dir = r.dir === 1 ? -1 : 1;
    const target = reachedBy(r);
    setState(target === "open" ? "opening" : "closing");
    if (target === "closed") {
      // The list is usable again while the sheet shrinks away.
      inertUndo.flush();
      lock();
    } else {
      unlock();
      shield();
    }
    const elapsed = Math.max(0, ...r.anims.map(time));
    const now = Number(document.timeline.currentTime ?? Number.NaN);
    if (elapsed <= 0 || !Number.isFinite(now)) {
      // Nothing has been painted yet: there is nothing to reverse.
      settle(target);
      return;
    }
    const { open: openMs, close: closeMs } = timing.duration;
    const speed = r.dir === 1 ? 1 : r.kind === "open" ? openMs / closeMs : closeMs / openMs;
    const rate = r.dir * speed;
    for (const a of r.anims) {
      // Every animation of a run shares one clock. Seeking them all to the
      // same point keeps short fades in step with the long flights.
      a.playbackRate = rate;
      a.startTime = now - elapsed / rate;
    }
    watch(r);
  }

  function begin(card: HTMLElement | null): Promise<boolean> {
    const owner = ++gen;
    current = card;
    session = { scroll: null, scaled: false, origin: "50% 30%" };
    setState("opening");
    const result = wait("open");
    let prepared: void | Promise<void>;
    try {
      prepared = hooks.prepare?.(card);
    } catch (error) {
      settle("closed");
      throw error;
    }
    if (prepared && typeof (prepared as Promise<void>).then === "function") {
      (prepared as Promise<void>).then(
        () => {
          if (owner === gen) start();
        },
        (error: unknown) => {
          if (owner !== gen) return;
          settle("closed");
          if (typeof reportError === "function") reportError(error);
        },
      );
    } else {
      start();
    }
    return result;
  }

  function start() {
    const card = current;
    const isReduced = reduced();
    const s = session as Session;
    if (card) s.scroll = saveScroll(hooks.scroller ?? scrollerOf(card));
    if (background && !isReduced && timing.backgroundScale !== false && !hasFixedDescendant(background)) {
      s.scaled = true;
      unit = measureUnit(background);
      s.origin = backgroundOrigin(rectOf(background), visibleBoxOf(background));
    }
    sheet.hidden = false;
    if (scrim) scrim.hidden = false;
    sheet.scrollTop = 0;
    for (const el of sheet.querySelectorAll("*")) if (el.scrollTop > 0) el.scrollTop = 0;

    const g = measure("open", card, isReduced);
    plan = g.plan;
    returnTo = pickReturn(card);
    shield();

    const r: Run = { kind: "open", dir: 1, anims: [], ghosts: [] };
    run = r;
    if (g.plan.choreography === "morph") buildOpen(r, g);
    else buildFadeOpen(r, isReduced);
    // The second click of a double click must not land on the sheet's content.
    const openMs = g.plan.choreography === "morph" ? timing.duration.open : choreography.fade.surface * 2;
    lock(0.5 * openMs * timing.timeScale);
    watch(r);
  }

  function pickReturn(card: HTMLElement | null): HTMLElement | null {
    const active = document.activeElement as HTMLElement | null;
    if (card) return active && card.contains(active) ? active : focusTargetIn(card);
    return active && active !== document.body && !sheet.contains(active) ? active : null;
  }

  function beginClose(): Promise<boolean> {
    gen++;
    const isReduced = reduced();
    setState("closing");
    cancelHolds();
    // Scroll first, then measure: the card must be found where the reader left it.
    if (timing.restoreScroll && session?.scroll) restoreScroll(session.scroll);
    const g = measure("close", current, isReduced);
    plan = g.plan;
    inertUndo.flush();
    const r: Run = { kind: "close", dir: 1, anims: [], ghosts: [] };
    run = r;
    if (g.plan.choreography === "morph") buildClose(r, g);
    else buildFadeClose(r, isReduced);
    lock();
    watch(r);
    return wait("closed");
  }

  function open(card?: HTMLElement | null): Promise<boolean> {
    if (destroyed) return Promise.resolve(false);
    const target = card ?? null;
    if (state === "open") return Promise.resolve(target === current);
    if (state === "opening") return target === current ? wait("open") : Promise.resolve(false);
    if (state === "closing") {
      if (run && target !== null && target === current) {
        flip(run);
        return wait("open");
      }
      // Another card: finish this close at once, then open the new one.
      gen++;
      settle("closed");
    }
    return begin(target);
  }

  function close(opts?: CloseOptions): Promise<boolean> {
    if (destroyed || state === "closed") return Promise.resolve(state === "closed");
    if (state === "closing") return wait("closed");
    let retarget = opts !== undefined && "to" in opts;
    let target = retarget ? (opts?.to ?? null) : current;
    if (!retarget && hooks.resolveCard) {
      const found = hooks.resolveCard(current);
      if (found !== current) {
        retarget = true;
        target = found;
      }
    }
    if (state === "opening") {
      if (!run) {
        // Still preparing: nothing is on screen yet.
        gen++;
        settle("closed");
        return Promise.resolve(true);
      }
      if (target === current) {
        flip(run);
        return wait("closed");
      }
      gen++;
      settle("open");
    }
    if (retarget) {
      current = target;
      returnTo = target ? focusTargetIn(target) : null;
    }
    return beginClose();
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented || !timing.closeOnEscape) return;
    if (state === "open" || state === "opening") {
      event.preventDefault();
      void close();
    }
  };
  const onClick = (event: Event) => {
    const target = event.target as Element | null;
    const trigger = target?.closest?.("[data-morph-close]");
    if (trigger && !trigger.closest(`[${GHOST_ATTR}]`)) void close();
  };
  document.addEventListener("keydown", onKey);
  sheet.addEventListener("click", onClick);
  scrim?.addEventListener("click", onClick);

  return {
    open,
    close,
    get state() {
      return state;
    },
    get card() {
      return current;
    },
    get plan() {
      return plan;
    },
    setOptions(next) {
      timing = resolveTiming(next, timing);
      hooks = {
        prepare: "prepare" in next ? next.prepare : hooks.prepare,
        onStateChange: "onStateChange" in next ? next.onStateChange : hooks.onStateChange,
        shared: "shared" in next ? next.shared : hooks.shared,
        radius: "radius" in next ? next.radius : hooks.radius,
        scroller: "scroller" in next ? next.scroller : hooks.scroller,
        resolveCard: "resolveCard" in next ? next.resolveCard : hooks.resolveCard,
      };
    },
    destroy() {
      if (destroyed) return;
      gen++;
      if (state !== "closed") settle("closed");
      destroyed = true;
      document.removeEventListener("keydown", onKey);
      sheet.removeEventListener("click", onClick);
      scrim?.removeEventListener("click", onClick);
    },
  };
}
