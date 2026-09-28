import { fullClip, fillFrames, insetClip, placeOver, toLocal } from "./geometry";
import { GHOST_ATTR, SHARED_ATTR, collectContent, collectRest, hasFixedDescendant, rectOf as screenRectOf } from "./dom";
import { choreography } from "./timing";
import type { MorphTiming } from "./types";
import type { Geometry, PairGeometry, Run, Session } from "./transition";

const EASE_OUT = "ease-out";

interface AnimationContext {
  sheet: HTMLElement;
  background: HTMLElement | null;
  scrim: HTMLElement | null;
  timing: MorphTiming;
  session: Session | null;
}

/** Build one run from measured geometry. Lifecycle and cleanup belong to morph.ts. */
export function buildAnimations(r: Run, g: Geometry, context: AnimationContext): void {
  const { sheet, background, scrim, timing, session } = context;
  const pending: Array<{ el: Element; frames: Keyframe[]; options: KeyframeAnimationOptions }> = [];
  function queueAnimation(el: Element, frames: Keyframe[], duration: number, delay = 0, easing = "linear") {
    pending.push({ el, frames, options: { duration: Math.max(0, duration), delay, easing, fill: "both" } });
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
      zIndex: "0",
    });
    ghost.style.borderColor = g.border ?? "transparent";

    const copies = new Map<string, HTMLElement>();
    const rest: Element[] = collectRest(ghost);
    const pairs = new Map(g.pairs.map((pair) => [pair.key, pair]));
    for (const node of ghost.querySelectorAll<HTMLElement>(`[${SHARED_ATTR}]`)) {
      const key = node.getAttribute(SHARED_ATTR) ?? "";
      const pair = pairs.get(key);
      if (pair?.mode === "scale") node.style.visibility = "hidden";
      else if (pair?.mode === "crossfade") copies.set(key, node);
      // Not flying (skipped or not in `shared`): it fades in place like the rest of the card.
      else rest.push(node);
    }
    // Paint the old card below the live shared elements. A topmost ghost
    // lets its opaque cover hide a live icon/photo whose ghost is hidden
    // (scale mode), making that element vanish until the cover fades out.
    sheet.prepend(ghost);
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

  /**
   * A sheet that does not cover the card at rest (a centred panel) starts
   * moved over it and slides into place while it grows, on the same curve,
   * so the surface and every flight follow the same path on screen as with
   * a sheet that covers the card.
   */
  function slide(g: Geometry, duration: number, back: boolean) {
    if (g.shift.x === 0 && g.shift.y === 0) return;
    const moved = { translate: `${g.shift.x}px ${g.shift.y}px` };
    const home = { translate: "0px 0px" };
    queueAnimation(sheet, back ? [home, moved] : [moved, home], duration, 0, timing.easing.surface);
  }

  function recede(duration: number, back: boolean, isReduced: boolean) {
    if (background && session?.scaled && !isReduced) {
      const still = { transform: "none", transformOrigin: session.origin };
      const away = { transform: `scale(${session.scale})`, transformOrigin: session.origin };
      queueAnimation(background, back ? [away, still] : [still, away], duration, 0, timing.easing.surface);
    }
    if (scrim) queueAnimation(scrim, back ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], duration, 0, EASE_OUT);
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

    queueAnimation(sheet, [{ clipPath: insetClip(g.clipBox, g.sheetBox, g.radius) }, { clipPath: fullClip(g.sheetRadius) }], D, 0, surface);
    if (g.colors) queueAnimation(sheet, [{ backgroundColor: g.colors[0] }, { backgroundColor: g.colors[1] }], D, 0, surface);

    const ghost = makeGhost(r, g);
    // After the ghost is placed: it is measured against the sheet at rest.
    slide(g, D, false);
    for (const p of g.pairs) {
      if (p.mode === "skip" || !p.dst) {
        // Nothing to fly from: appear once the flights around it have landed.
        if (p.dst) queueAnimation(p.dst, [{ opacity: 0 }, { opacity: 1 }], k.lateIn * D, (1 - k.lateIn) * D, EASE_OUT);
        continue;
      }
      const fill = p.fill ? fillOf(p, "open") : null;
      queueAnimation(
        p.dst,
        fill
          ? fill.big
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
        queueAnimation(
          copy,
          fill
            ? fill.small
            : [
                { transform: "none", transformOrigin: "0 0" },
                { transform: placeOver(p.srcBox, p.dstBox, 1 / p.scale), transformOrigin: "0 0" },
              ],
          D,
          0,
          surface,
        );
        queueAnimation(copy, [{ opacity: 1 }, { opacity: 0 }], k.copyOut * D, 0, EASE_OUT);
      }
      queueAnimation(p.dst, [{ opacity: 0 }, { opacity: 1 }], k.targetIn * D, 0, EASE_OUT);
    }
    for (const el of ghost.rest) queueAnimation(el, [{ opacity: 1 }, { opacity: 0 }], k.restOut * D, 0, EASE_OUT);
    if (g.border) queueAnimation(ghost.root, [{ borderColor: g.border }, { borderColor: "transparent" }], k.borderOut * D, 0, EASE_OUT);

    const parts = collectContent(sheet);
    parts.stagger.forEach((el, i) => {
      const frames = hasFixedDescendant(el)
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "none" },
          ];
      queueAnimation(el, frames, k.content * D, (k.contentDelay * timing.duration.open + i * timing.stagger) * timing.timeScale, content);
    });
    for (const el of parts.plain) queueAnimation(el, [{ opacity: 0 }, { opacity: 1 }], k.content * D, k.contentDelay * D, content);
    for (const el of parts.docks) {
      const frames = hasFixedDescendant(el)
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ transform: "translateY(100%)" }, { transform: "none" }];
      queueAnimation(el, frames, k.dock * D, k.dockDelay * D, content);
    }

    recede(D, false, false);
  }

  function buildClose(r: Run, g: Geometry) {
    const C = timing.duration.close * timing.timeScale;
    const k = choreography.close;
    const surface = timing.easing.surface;

    queueAnimation(sheet, [{ clipPath: fullClip(g.sheetRadius) }, { clipPath: insetClip(g.clipBox, g.sheetBox, g.radius) }], C, 0, surface);
    if (g.colors) queueAnimation(sheet, [{ backgroundColor: g.colors[1] }, { backgroundColor: g.colors[0] }], C, 0, surface);

    const ghost = makeGhost(r, g);
    slide(g, C, true);
    let anchor: PairGeometry | null = null;
    for (const p of g.pairs) {
      if (p.mode === "skip" || !p.dst) {
        if (p.dst) queueAnimation(p.dst, [{ opacity: 1 }, { opacity: 0 }], k.contentOut * C, 0, EASE_OUT);
        continue;
      }
      if (!anchor || p.dstBox.top + p.dstBox.height > anchor.dstBox.top + anchor.dstBox.height) anchor = p;
      const fill = p.fill ? fillOf(p, "close") : null;
      queueAnimation(
        p.dst,
        fill
          ? fill.big
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
        queueAnimation(
          copy,
          fill
            ? fill.small
            : [
                { transform: placeOver(p.srcBox, p.dstBox, 1 / p.scale), transformOrigin: "0 0" },
                { transform: "none", transformOrigin: "0 0" },
              ],
          C,
          0,
          surface,
        );
        queueAnimation(copy, [{ opacity: 0 }, { opacity: 1 }], k.copyIn * C, 0, EASE_OUT);
      }
      queueAnimation(p.dst, [{ opacity: 1 }, { opacity: 0 }], k.targetOut * C, 0, EASE_OUT);
    }
    // The rest of the card comes back at the end, finishing with everything else.
    for (const el of ghost.rest) queueAnimation(el, [{ opacity: 0 }, { opacity: 1 }], k.rest * C, k.restDelay * C, EASE_OUT);
    if (g.border) queueAnimation(ghost.root, [{ borderColor: "transparent" }, { borderColor: g.border }], k.rest * C, k.restDelay * C, EASE_OUT);

    // Content follows the lowest flying element down into the card and fades.
    const parts = collectContent(sheet);
    const follow = anchor
      ? `translate(${anchor.srcBox.left - anchor.dstBox.left}px, ${anchor.srcBox.top - anchor.dstBox.top}px)`
      : null;
    for (const el of parts.stagger) {
      if (follow && !hasFixedDescendant(el)) queueAnimation(el, [{ transform: "none" }, { transform: follow }], C, 0, surface);
      queueAnimation(el, [{ opacity: 1 }, { opacity: 0 }], k.contentOut * C, 0, EASE_OUT);
    }
    for (const el of parts.plain) queueAnimation(el, [{ opacity: 1 }, { opacity: 0 }], k.contentOut * C, 0, EASE_OUT);
    for (const el of parts.docks) {
      const frames = hasFixedDescendant(el)
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [{ transform: "none" }, { transform: "translateY(100%)" }];
      queueAnimation(el, frames, k.dock * C, 0, EASE_OUT);
    }

    recede(C, true, false);
  }

  function sheetChildren(): Element[] {
    return Array.from(sheet.children).filter((el) => !el.hasAttribute(GHOST_ATTR));
  }

  /** Opacity only: the empty surface first, then the content, so two screens of text never overlap. */
  function buildFadeOpen(isReduced: boolean) {
    const f = choreography.fade;
    const t = timing.timeScale;
    queueAnimation(sheet, [{ opacity: 0 }, { opacity: 1 }], f.surface * t, 0, "ease");
    for (const el of sheetChildren()) queueAnimation(el, [{ opacity: 0 }, { opacity: 1 }], f.content * t, f.contentDelay * t, "ease");
    recede((f.contentDelay + f.content) * t, false, isReduced);
  }

  function buildFadeClose(isReduced: boolean) {
    const f = choreography.fade;
    const t = timing.timeScale;
    for (const el of sheetChildren()) queueAnimation(el, [{ opacity: 1 }, { opacity: 0 }], f.closeContent * t, 0, "ease");
    queueAnimation(sheet, [{ opacity: 1 }, { opacity: 0 }], f.closeSurface * t, f.closeSurfaceDelay * t, "ease");
    recede((f.closeSurfaceDelay + f.closeSurface) * t, true, isReduced);
  }

  if (g.plan.choreography === "morph") {
    if (r.kind === "open") buildOpen(r, g);
    else buildClose(r, g);
  } else if (r.kind === "open") buildFadeOpen(g.plan.reduced);
  else buildFadeClose(g.plan.reduced);

  // animate() invalidates styles. Finish all DOM/style reads (including
  // fixed-descendant checks and ghost placement) before starting any effect,
  // otherwise each content block forces another style recalculation.
  for (const { el, frames, options } of pending) r.anims.push(el.animate(frames, options));
}
