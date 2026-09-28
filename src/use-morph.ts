/**
 * useMorph: the React API. The sheet stays mounted; the hook shows and hides
 * it. The engine underneath (createMorph in ./morph) has no React in it.
 *
 *   const morph = useMorph();
 *   <li onClick={(e) => morph.open(e.currentTarget, () => setItem(item))}>…</li>
 *   <div ref={morph.backgroundRef}>…list…</div>
 *   <div ref={morph.scrimRef} className="scrim" hidden />
 *   <section ref={morph.sheetRef} className="sheet" hidden>…detail of item…</section>
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { type CloseOptions, type Morph, type MorphOptions, type MorphState, createMorph } from "./morph";

export type UseMorphOptions = Omit<MorphOptions, "sheet" | "background" | "scrim" | "prepare">;

export interface UseMorph {
  sheetRef: (el: HTMLElement | null) => void;
  backgroundRef: (el: HTMLElement | null) => void;
  scrimRef: (el: HTMLElement | null) => void;
  state: MorphState;
  /**
   * Opens the sheet from `card`. `update` runs inside flushSync before
   * anything is measured, so the sheet already shows the new item.
   */
  open(card: HTMLElement | null, update?: () => void): Promise<boolean>;
  close(options?: CloseOptions): Promise<boolean>;
  /** The underlying instance, once the sheet is mounted. */
  readonly instance: Morph | null;
}

export function useMorph(options: UseMorphOptions = {}): UseMorph {
  const [state, setState] = useState<MorphState>("closed");
  const [sheet, setSheet] = useState<HTMLElement | null>(null);
  const [background, setBackground] = useState<HTMLElement | null>(null);
  const [scrim, setScrim] = useState<HTMLElement | null>(null);
  const instance = useRef<Morph | null>(null);
  const pending = useRef<(() => void) | undefined>(undefined);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    if (!sheet) return;
    const morph = createMorph({
      ...latest.current,
      sheet,
      background,
      scrim,
      prepare: () => {
        const update = pending.current;
        pending.current = undefined;
        if (update) flushSync(update);
      },
      onStateChange: (next, card) => {
        setState(next);
        latest.current.onStateChange?.(next, card);
      },
    });
    instance.current = morph;
    return () => {
      morph.destroy();
      if (instance.current === morph) instance.current = null;
      setState("closed");
    };
  }, [sheet, background, scrim]);

  useEffect(() => {
    const { onStateChange: _ignored, ...rest } = options;
    instance.current?.setOptions(rest);
  });

  const open = useCallback((card: HTMLElement | null, update?: () => void) => {
    const morph = instance.current;
    if (!morph) {
      if (update) update();
      return Promise.resolve(false);
    }
    pending.current = update;
    const result = morph.open(card);
    // prepare runs synchronously inside open(); drop the update if it did not start.
    pending.current = undefined;
    return result;
  }, []);

  const close = useCallback((opts?: CloseOptions) => instance.current?.close(opts) ?? Promise.resolve(true), []);

  return useMemo(
    () => ({
      sheetRef: setSheet,
      backgroundRef: setBackground,
      scrimRef: setScrim,
      state,
      open,
      close,
      get instance() {
        return instance.current;
      },
    }),
    [state, open, close],
  );
}

