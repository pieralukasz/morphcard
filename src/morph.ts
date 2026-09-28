/**
 * createMorph: a card that grows into a full detail sheet and shrinks back.
 *
 * The sheet is one surface whose clip-path starts as the card's shape. Shared
 * elements (data-morph="key") fly from the card to their place on the sheet.
 * Everything else fades or slides. All motion uses the Web Animations API, so
 * a close that arrives mid-open reverses the running animations from where
 * they are instead of jumping.
 */
import { FOCUSABLE, GHOST_ATTR, Undo, focusTargetIn, hasFixedDescendant, restoreScroll, saveScroll, scrollerOf } from "./dom";
import { buildAnimations } from "./animate";
import { activate, deactivate, isTopLayer } from "./layers";
import { backgroundOriginFor, measureTransition } from "./measure";
import { choreography, defaults, durationFor, resolveTiming } from "./timing";
import type { CloseOptions, Morph, MorphOptions, MorphPlan, MorphState } from "./types";
import type { Run, Session } from "./transition";

// Internal engine consumers (examples and fixtures) share the same contracts.
export type { CloseOptions, Morph, MorphOptions, MorphPlan, MorphState, MorphTiming, PairReport, SkipReason } from "./types";
export { choreography, defaults, resolveTiming } from "./timing";

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

  // ------------------------------------------------------------- lifecycle

  function applyHolds() {
    cancelHolds();
    const hold = (el: Element, frame: Keyframe) => holds.push(el.animate([frame, frame], { duration: 0, fill: "forwards" }));
    if (background && session?.scaled) {
      hold(background, { transform: `scale(${session.scale})`, transformOrigin: session.origin });
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
      deactivate(sheet);
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
    const destinationMs = durationFor(target === "open" ? "open" : "close", timing, plan?.choreography === "fade");
    if (elapsed <= 0 || !Number.isFinite(now) || destinationMs <= 0) {
      // Nothing has been painted yet: there is nothing to reverse.
      settle(target);
      return;
    }
    const speed = r.duration > 0 ? r.duration / destinationMs : 1;
    const rate = r.dir * speed;
    for (const a of r.anims) {
      // Every animation of a run shares one clock. Seeking them all to the
      // same point keeps short fades in step with the long flights.
      // Let the browser establish the next start time. Assigning startTime
      // directly can advance WebKit's composited transform within this task,
      // even though currentTime still reports the saved position.
      a.pause();
      a.playbackRate = rate;
      a.currentTime = elapsed;
      a.play();
    }
    watch(r);
  }

  function begin(card: HTMLElement | null): Promise<boolean> {
    const owner = ++gen;
    activate(sheet);
    current = card;
    session = { scroll: null, scaled: false, scale: 1, origin: "50% 30%" };
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
    try {
      startOpen();
    } catch (error) {
      gen++;
      settle("closed");
      throw error;
    }
  }

  function startOpen() {
    const card = current;
    const isReduced = reduced();
    const s = session as Session;
    if (card) s.scroll = saveScroll(hooks.scroller ?? scrollerOf(card));
    if (background && !isReduced && timing.backgroundScale !== false && !hasFixedDescendant(background)) {
      s.scaled = true;
      s.scale = timing.backgroundScale;
      s.origin = backgroundOriginFor(background);
    }
    sheet.hidden = false;
    if (scrim) scrim.hidden = false;
    sheet.scrollTop = 0;
    for (const el of sheet.querySelectorAll("*")) if (el.scrollTop > 0) el.scrollTop = 0;

    const g = measureTransition("open", card, isReduced, { ...hooks, sheet, backgroundScaled: s.scaled });
    plan = g.plan;
    returnTo = pickReturn(card);
    shield();

    const r: Run = { kind: "open", dir: 1, anims: [], ghosts: [], duration: durationFor("open", timing, g.plan.choreography === "fade") };
    run = r;
    buildAnimations(r, g, { sheet, background, scrim, timing, session });
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
    try {
      return startClose();
    } catch (error) {
      gen++;
      settle("closed");
      throw error;
    }
  }

  function startClose(): Promise<boolean> {
    gen++;
    const isReduced = reduced();
    setState("closing");
    cancelHolds();
    // Scroll first, then measure: the card must be found where the reader left it.
    if (timing.restoreScroll && session?.scroll) restoreScroll(session.scroll);
    const g = measureTransition("close", current, isReduced, { ...hooks, sheet, backgroundScaled: Boolean(session?.scaled) });
    plan = g.plan;
    inertUndo.flush();
    const r: Run = { kind: "close", dir: 1, anims: [], ghosts: [], duration: durationFor("close", timing, g.plan.choreography === "fade") };
    run = r;
    buildAnimations(r, g, { sheet, background, scrim, timing, session });
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
        const result = wait("open");
        flip(run);
        return result;
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
        const result = wait("closed");
        flip(run);
        return result;
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
    if (event.key !== "Escape" || event.defaultPrevented || !timing.closeOnEscape || !isTopLayer(sheet)) return;
    // Keep a second Escape during close from dismissing a lower sheet.
    event.preventDefault();
    if (state === "open" || state === "opening") {
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
