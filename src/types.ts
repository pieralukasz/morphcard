import type { Scroller } from "./dom";

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
