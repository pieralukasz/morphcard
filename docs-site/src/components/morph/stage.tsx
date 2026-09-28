"use client";
/**
 * One useMorph instance per page, shared by every tile that grows into a
 * sheet (hero cards, feature tiles, video tiles, code cards, topic cards).
 *
 * The sheet and scrim are portaled to <body>: the background (the page
 * content) must not contain the sheet, and the sheet covers the navigation.
 *
 *   <MorphStage>…page…</MorphStage>              wraps the page in a background
 *   <MorphStage background="#nd-page">…</MorphStage>   uses an existing element
 *   const stage = useStage();
 *   stage.open(tileElement, { label: "Title", render: () => <Sheet… /> });
 *
 * On a wide screen the sheet is a centred panel; on a phone it fills the
 * screen. A card outside the panel's box (cut off at the bottom of the
 * screen) still works: the library starts the panel moved over the card and
 * slides it into place while it grows.
 */
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type UseMorph, useMorph } from "react-morphcard";
import { MORPH_DEFAULTS, type MorphTuning } from "./defaults";

export type StageState = UseMorph["state"];


export interface StageEntry {
  /** Accessible name of the sheet. */
  label: string;
  render: () => ReactNode;
  /** Styling hook for the sheet: "tile", "video", "code", "example". */
  kind?: string;
}

interface Stage {
  open(card: HTMLElement | null, entry: StageEntry): Promise<boolean>;
  close(options?: { to?: HTMLElement | null }): Promise<boolean>;
  state: StageState;
  /** Overrides the timing for this page (the playground). null restores the defaults. */
  configure(options: MorphTuning | null): void;
}

const StageContext = createContext<Stage | null>(null);

export function useStage(): Stage {
  const stage = useContext(StageContext);
  if (!stage) throw new Error("useStage must be used inside <MorphStage>");
  return stage;
}

export function MorphStage({
  children,
  background,
  className,
}: {
  children: ReactNode;
  /** Selector of an existing element to use as the background. Default: a wrapper div. */
  background?: string;
  className?: string;
}) {
  const [tuned, setTuned] = useState<MorphTuning | null>(null);
  const morph = useMorph({ ...MORPH_DEFAULTS, ...tuned, closeOnEscape: true, restoreScroll: true });
  const [entry, setEntry] = useState<StageEntry | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const pathname = usePathname();
  useEffect(() => setHost(document.body), []);

  const { open: morphOpen, close: morphClose, backgroundRef } = morph;

  // The docs layout owns its grid, so the article column is found by id and
  // looked up again after every navigation.
  useEffect(() => {
    if (background) backgroundRef(document.querySelector<HTMLElement>(background));
  }, [background, backgroundRef, pathname]);

  // A link inside the sheet navigated: fade the sheet out over the new page.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    void morphClose({ to: null });
  }, [pathname, morphClose]);

  const open = useCallback(
    (card: HTMLElement | null, next: StageEntry) => morphOpen(card, () => setEntry(next)),
    [morphOpen],
  );
  const close = useCallback((options?: { to?: HTMLElement | null }) => morphClose(options), [morphClose]);
  const configure = useCallback((options: MorphTuning | null) => setTuned(options), []);
  const stage = useMemo(() => ({ open, close, configure, state: morph.state }), [open, close, configure, morph.state]);

  // The page behind must not scroll while the sheet covers it. The root has
  // scrollbar-gutter: stable, so hiding overflow does not shift the layout.
  const covering = morph.state !== "closed";
  useEffect(() => {
    if (!covering) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [covering]);

  // With an inner background (the docs article), the library makes only that
  // element inert. The sidebar and the table of contents must not take focus
  // either while the sheet is up, so the whole page goes inert here. It
  // becomes interactive again as soon as a close starts, like the library's
  // own background, so focus can return to the card.
  const wrapper = useRef<HTMLDivElement>(null);
  const modal = morph.state === "opening" || morph.state === "open";
  useEffect(() => {
    const el = wrapper.current;
    if (!background || !el) return;
    el.inert = modal;
  }, [background, modal]);

  return (
    <StageContext.Provider value={stage}>
      <div ref={background ? wrapper : backgroundRef} className={className}>
        {children}
      </div>
      {host
        ? createPortal(
            <>
              <div ref={morph.scrimRef} className="mcs-scrim" data-morph-close hidden />
              <section
                ref={morph.sheetRef}
                className="mcs-sheet"
                role="dialog"
                aria-modal="true"
                aria-label={entry?.label}
                data-kind={entry?.kind}
                hidden
              >
                <div className="mcs-bar" data-morph-stagger>
                  <button type="button" className="mcs-back" data-morph-close data-morph-focus>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M19 12H5M11 6l-6 6 6 6" />
                    </svg>
                    Back
                  </button>
                  <kbd className="mcs-esc" aria-hidden="true">
                    Esc
                  </kbd>
                </div>
                <div className="mcs-body">{entry?.render()}</div>
              </section>
            </>,
            host,
          )
        : null}
    </StageContext.Provider>
  );
}
