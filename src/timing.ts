import type { MorphOptions, MorphTiming } from "./types";

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

export function durationFor(direction: "open" | "close", timing: MorphTiming, fade: boolean): number {
  const f = choreography.fade;
  const ms = fade
    ? direction === "open" ? f.contentDelay + f.content : f.closeSurfaceDelay + f.closeSurface
    : timing.duration[direction];
  return ms * timing.timeScale;
}
