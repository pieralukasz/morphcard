"use client";
/**
 * One morphcard instance per page, shared by every tile that grows into a
 * sheet (feature tiles, video tiles, code cards, topic cards).
 *
 * It uses the library's own React binding, useMorph from morphcard/react,
 * imported from the source in this repository. The sheet and scrim are
 * portaled to <body>: the background (the page content) must not contain
 * the sheet, and the sheet must cover the navigation bar too.
 *
 *   <MorphStage>…page…</MorphStage>
 *   const stage = useStage();
 *   stage.open(tileElement, { label: "Title", render: () => <Sheet… /> });
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { type MorphState, type UseMorphOptions, useMorph } from "../../../../src/react";

export interface StageEntry {
  /** Accessible name of the sheet. */
  label: string;
  render: () => ReactNode;
  /** Wider column for media and code. */
  wide?: boolean;
}

interface Stage {
  open(card: HTMLElement | null, entry: StageEntry): Promise<boolean>;
  close(): Promise<boolean>;
  state: MorphState;
}

const StageContext = createContext<Stage | null>(null);

export function useStage(): Stage {
  const stage = useContext(StageContext);
  if (!stage) throw new Error("useStage must be used inside <MorphStage>");
  return stage;
}

export function MorphStage({
  children,
  className,
  options,
}: {
  children: ReactNode;
  className?: string;
  options?: UseMorphOptions;
}) {
  const morph = useMorph(options);
  const [entry, setEntry] = useState<StageEntry | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);

  const { open: morphOpen, close: morphClose } = morph;
  const open = useCallback(
    (card: HTMLElement | null, next: StageEntry) => morphOpen(card, () => setEntry(next)),
    [morphOpen],
  );
  const close = useCallback(() => morphClose(), [morphClose]);
  const stage = useMemo(() => ({ open, close, state: morph.state }), [open, close, morph.state]);

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

  return (
    <StageContext.Provider value={stage}>
      <div ref={morph.backgroundRef} className={className}>
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
                data-wide={entry?.wide ? "" : undefined}
                hidden
              >
                <div className="mcs-bar" data-morph-stagger>
                  <button type="button" className="mcs-back" data-morph-close data-morph-focus>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M19 12H5M11 6l-6 6 6 6" />
                    </svg>
                    Back
                  </button>
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
