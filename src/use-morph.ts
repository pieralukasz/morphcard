/**
 * useMorph: the public API. The sheet stays mounted; the hook shows and hides
 * it. The engine underneath (createMorph in ./morph) has no React in it and
 * is not part of the package's exports.
 *
 *   const morph = useMorph<Delivery>();
 *   <main ref={morph.backgroundRef}>
 *     <article ref={morph.cardRef(d.id)} onClick={() => morph.open({ key: d.id, item: d })}>…</article>
 *   </main>
 *   <div ref={morph.scrimRef} data-morph-close hidden />
 *   <section ref={morph.sheetRef} hidden>{morph.item && <Detail d={morph.item} />}</section>
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { type Morph, type MorphOptions, type MorphState, createMorph, defaults, resolveTiming } from "./morph";

export type UseMorphOptions = Omit<MorphOptions, "sheet" | "background" | "scrim" | "prepare" | "resolveCard">;

/** Identifies a card registered with `cardRef(key)`. */
export type MorphKey = string | number;

/** The object form of `open`'s first argument. */
export interface MorphTarget<T> {
  /** A card registered with `cardRef(key)`. */
  key?: MorphKey;
  /** A card element. Used instead of the registered one when both are given. */
  card?: HTMLElement | null;
  /** Becomes `item` inside flushSync, before anything is measured. */
  item?: T;
}

export interface UseMorphCloseOptions {
  /**
   * The card to return to: an element, a key registered with `cardRef`, or
   * null to fade out. Default: the card it opened from, or the element now
   * registered under the same key if the list re-rendered.
   */
  to?: HTMLElement | MorphKey | null;
}

/** Read-only view of the engine, for debugging a transition. */
export type MorphInstance = Pick<Morph, "state" | "card" | "plan">;

export interface UseMorph<T = unknown> {
  sheetRef: (el: HTMLElement | null) => void;
  backgroundRef: (el: HTMLElement | null) => void;
  scrimRef: (el: HTMLElement | null) => void;
  /** A stable callback ref for each key. `open(key)` finds the card through it. */
  cardRef: (key: MorphKey) => (el: HTMLElement | null) => void;
  state: MorphState;
  /**
   * The item passed to the latest `open`. Set before measuring and cleared
   * once the sheet has finished closing, so the sheet never empties mid-flight.
   */
  item: T | null;
  /**
   * Opens the sheet from a card element, a key registered with `cardRef`, or
   * `{ key, card, item }`. null opens without a flight (deep link). `update`
   * runs inside flushSync before anything is measured.
   */
  open(target: HTMLElement | MorphKey | MorphTarget<T> | null, update?: () => void): Promise<boolean>;
  close(options?: UseMorphCloseOptions): Promise<boolean>;
  /** The engine once the sheet is mounted, for reading `plan` and `card`. */
  readonly instance: MorphInstance | null;
}

interface Pending {
  key: MorphKey | null;
  apply: () => void;
}

const isKey = (value: unknown): value is MorphKey => typeof value === "string" || typeof value === "number";
const isElement = (value: unknown): value is HTMLElement =>
  typeof value === "object" && value !== null && "nodeType" in value;

export function useMorph<T = unknown>(options: UseMorphOptions = {}): UseMorph<T> {
  const [state, setState] = useState<MorphState>("closed");
  const [item, setItem] = useState<T | null>(null);
  const [sheet, setSheet] = useState<HTMLElement | null>(null);
  const [background, setBackground] = useState<HTMLElement | null>(null);
  const [scrim, setScrim] = useState<HTMLElement | null>(null);
  const instance = useRef<Morph | null>(null);
  const pending = useRef<Pending | null>(null);
  const latest = useRef(options);
  latest.current = options;
  // Cards registered with cardRef, one callback per key, and the key the sheet opened from.
  const cards = useRef(new Map<MorphKey, HTMLElement>());
  const refs = useRef(new Map<MorphKey, (el: HTMLElement | null) => void>());
  const openKey = useRef<MorphKey | null>(null);

  // The element registered under `key`, if it is still in the document.
  const cardFor = useCallback((key: MorphKey): HTMLElement | null => {
    const el = cards.current.get(key);
    return el?.isConnected ? el : null;
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const morph = createMorph({
      ...latest.current,
      sheet,
      background,
      scrim,
      prepare: () => {
        const next = pending.current;
        pending.current = null;
        openKey.current = next?.key ?? null;
        if (next) flushSync(next.apply);
      },
      // A close without `to` follows the card if the list re-rendered it.
      resolveCard: (card) => (openKey.current !== null && cardFor(openKey.current)) || card,
      onStateChange: (next, card) => {
        setState(next);
        if (next === "closed") {
          openKey.current = null;
          setItem(null);
        }
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

  // Options are declarative: one removed since the last render goes back to
  // its default instead of keeping the old value. Applied after every render,
  // and again right before open and close so a run never uses stale ones.
  const applyOptions = useCallback(() => {
    const next = latest.current;
    instance.current?.setOptions({
      ...resolveTiming(next, defaults),
      shared: next.shared,
      radius: next.radius,
      scroller: next.scroller,
    });
  }, []);
  useEffect(applyOptions);

  const cardRef = useCallback((key: MorphKey) => {
    let ref = refs.current.get(key);
    if (!ref) {
      ref = (el: HTMLElement | null) => {
        if (el) {
          cards.current.set(key, el);
          return;
        }
        // React may attach the next element for this key before or after it
        // detaches the old one. Forget the key once the commit is done and
        // nothing connected is left under it.
        queueMicrotask(() => {
          if (cards.current.get(key)?.isConnected) return;
          cards.current.delete(key);
          refs.current.delete(key);
        });
      };
      refs.current.set(key, ref);
    }
    return ref;
  }, []);

  const open = useCallback((target: HTMLElement | MorphKey | MorphTarget<T> | null, update?: () => void) => {
    let card: HTMLElement | null = null;
    let key: MorphKey | null = null;
    let hasItem = false;
    let nextItem: T | null = null;
    if (isKey(target)) key = target;
    else if (isElement(target)) card = target;
    else if (target) {
      key = target.key ?? null;
      card = target.card ?? null;
      if ("item" in target) {
        hasItem = true;
        nextItem = target.item ?? null;
      }
    }
    if (!card && key !== null) card = cardFor(key);
    const apply = () => {
      if (hasItem) setItem(nextItem);
      update?.();
    };
    const morph = instance.current;
    if (!morph) {
      apply();
      return Promise.resolve(false);
    }
    applyOptions();
    pending.current = { key, apply };
    const result = morph.open(card);
    // prepare runs synchronously inside open(); drop the update if it did not start.
    pending.current = null;
    return result;
  }, [cardFor, applyOptions]);

  const close = useCallback((opts?: UseMorphCloseOptions) => {
    const morph = instance.current;
    if (!morph) return Promise.resolve(true);
    applyOptions();
    if (!opts || !("to" in opts)) return morph.close();
    const to = opts.to ?? null;
    return morph.close({ to: isKey(to) ? cardFor(to) : to });
  }, [cardFor, applyOptions]);

  return useMemo(
    () => ({
      sheetRef: setSheet,
      backgroundRef: setBackground,
      scrimRef: setScrim,
      cardRef,
      state,
      item,
      open,
      close,
      get instance(): MorphInstance | null {
        return instance.current;
      },
    }),
    [state, item, cardRef, open, close],
  );
}
