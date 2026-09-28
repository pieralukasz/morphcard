import type { Box, Shift } from "./geometry";
import type { SavedScroll } from "./dom";
import type { MorphPlan, PairReport } from "./types";

export interface Run {
  kind: "open" | "close";
  /** 1 plays the run as built, -1 plays it backwards. */
  dir: 1 | -1;
  anims: Animation[];
  ghosts: HTMLElement[];
  /** Nominal duration when these keyframes were built, including timeScale. */
  duration: number;
}

export interface PairGeometry extends PairReport {
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

export interface Geometry {
  plan: MorphPlan;
  card: HTMLElement | null;
  cardBox: Box;
  /** The visible part of the card: where the surface starts and ends. */
  clipBox: Box;
  sheetBox: Box;
  /**
   * Where the sheet starts (open) or ends (close), relative to its place:
   * non-zero when the sheet at rest does not cover the card. cardBox,
   * clipBox and the pairs' srcBox are given relative to the moved sheet.
   */
  shift: Shift;
  /** Screen pixels per CSS pixel of the sheet; boxes above are in CSS pixels. */
  unit: number;
  radius: number;
  sheetRadius: number;
  colors: [string, string] | null;
  border: string | null;
  pairs: PairGeometry[];
}

export interface Session {
  scroll: SavedScroll | null;
  scaled: boolean;
  /** Background scale captured on open; later options apply to the next session. */
  scale: number;
  origin: string;
}
