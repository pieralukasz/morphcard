/**
 * The library's default timing, spelled out. Options are merged into the
 * running instance, so resetting the playground has to name every value.
 */
export const MORPH_DEFAULTS = {
  duration: { open: 400, close: 300 },
  easing: { surface: "cubic-bezier(0.32, 0.72, 0, 1)", content: "cubic-bezier(0.23, 1, 0.32, 1)" },
  stagger: 45,
  backgroundScale: 0.96 as number | false,
  timeScale: 1,
  reducedMotion: "system" as "system" | boolean,
};

export type MorphTuning = Partial<typeof MORPH_DEFAULTS>;
