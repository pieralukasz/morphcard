"use client";
/**
 * The Relay deliveries demo from examples/, ported to React on useMorph. It
 * reuses the demo's data and stylesheet and sits in a phone-sized frame whose
 * list scrolls inside it.
 *
 * Hooks used by scripts/demo-frame-check.mjs and scripts/docs-smoke.mjs:
 * [data-live-demo] gets data-ready once mounted, cards are
 * .mc-card[data-id] .mc-card-hit, the sheet is .mc-sheet with
 * data-morph-state (set by the library), Back is .mc-sheet .mc-back, and the
 * controls row is the next sibling of [data-live-demo].
 */
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMorph } from "react-morphcard";
import { deliveries, findDelivery, stages } from "../../../examples/shared/data.js";
import "../../../examples/shared/demo.css";
import { MORPH_DEFAULTS, type MorphTuning } from "./morph/defaults";

type Delivery = (typeof deliveries)[number];

export interface DemoHandle {
  readonly state: string;
  open(id: string): Promise<boolean>;
  close(): Promise<boolean>;
}

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 12h15M14 7l5 5-5 5" />
  </svg>
);

function Route({ d }: { d: Delivery }) {
  return (
    <>
      <span className="mc-leg">
        {d.from}
        <i>{d.fc}</i>
      </span>
      <Arrow />
      <span className="mc-leg">
        {d.to}
        <i>{d.tc}</i>
      </span>
    </>
  );
}

const TABS: [string, ReactNode][] = [
  [
    "Deliveries",
    <>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>,
  ],
  ["Map", <path key="m" d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />],
  ["Inbox", <path key="i" d="M4 13h4l2 3h4l2-3h4M5 5h14l1 8v6H4v-6z" />],
  [
    "Account",
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>,
  ],
];

/**
 * `options` (from the playground) replace the built-in toggles. `theme`
 * "site" follows the docs theme.
 */
export function LiveDemo({
  controls = true,
  options,
  theme = "site",
  onReady,
  onState,
  className,
}: {
  controls?: boolean;
  options?: MorphTuning;
  theme?: "site" | "light" | "dark";
  onReady?: (demo: DemoHandle) => void;
  onState?: (state: string) => void;
  className?: string;
}) {
  const [slow, setSlow] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [item, setItem] = useState<Delivery | null>(null);
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onReady, onState });
  callbacks.current = { onReady, onState };

  const tuning = options ?? { timeScale: slow ? 4 : 1, reducedMotion: reduce ? true : ("system" as const) };
  const morph = useMorph({
    ...MORPH_DEFAULTS,
    ...tuning,
    onStateChange: (next) => callbacks.current.onState?.(next),
  });
  const latest = useRef(morph);
  latest.current = morph;

  const handle = useMemo<DemoHandle>(
    () => ({
      get state() {
        return latest.current.instance?.state ?? "closed";
      },
      open(id: string) {
        const card = root.current?.querySelector<HTMLElement>(`.mc-card[data-id="${id}"]`) ?? null;
        const d = findDelivery(id);
        return latest.current.open(card, () => setItem(d ?? null));
      },
      close: () => latest.current.close(),
    }),
    [],
  );

  // data-ready once the library instance exists (the sheet ref is attached).
  useEffect(() => {
    if (!morph.instance || ready) return;
    setReady(true);
    callbacks.current.onReady?.(handle);
  });

  const uid = "mcdemo";
  const d = item;
  return (
    <div className={`not-prose mc-live ${className ?? ""}`}>
      <div
        ref={root}
        className={`mc-device mc-demo is-frame${theme === "dark" ? " is-dark" : ""}${theme === "light" ? " is-light" : ""}`}
        data-live-demo=""
        data-ready={ready ? "1" : undefined}
      >
        <header className="mc-topbar">
          <div className="mc-logo" aria-hidden="true">
            R
          </div>
          <div className="mc-brand">Relay</div>
          <nav className="mc-topnav" aria-label="Sections">
            <span className="on">Deliveries</span>
            <span>Map</span>
            <span>Inbox</span>
          </nav>
          <div className="mc-avatar" aria-hidden="true">
            JD
          </div>
        </header>
        <main className="mc-screen" ref={morph.backgroundRef}>
          <h1>Deliveries</h1>
          <p className="mc-sub">This week · {deliveries.length} deliveries</p>
          <div className="mc-search">Search deliveries</div>
          <div className="mc-filters">
            <span className="on">All {deliveries.length}</span>
            <span>Scheduled</span>
            <span>In transit</span>
            <span>Delivered</span>
          </div>
          <ul className="mc-list">
            {deliveries.map((c) => (
              <li key={c.id}>
                <article className="mc-card" data-id={c.id}>
                  <button
                    className="mc-card-hit"
                    type="button"
                    aria-label={`Open delivery ${c.id}, ${c.from} to ${c.to}`}
                    onClick={(e) => morph.open(e.currentTarget.parentElement, () => setItem(c))}
                  />
                  <div className="mc-card-main">
                    <div className="mc-route" data-morph="route">
                      <Route d={c} />
                    </div>
                    <div className="mc-party" data-morph="party">
                      {c.company}
                    </div>
                    <div className="mc-ref" data-morph="ref">
                      #{c.id} · {c.date}
                    </div>
                    <div className="mc-meta">{c.meta}</div>
                  </div>
                  <div className="mc-card-side">
                    <span className={`mc-badge ${c.status}`} data-morph="badge">
                      {c.label}
                    </span>
                    <svg className="mc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </main>
        <nav className="mc-tabbar" aria-label="Tabs">
          {TABS.map(([label, path], i) => (
            <div key={label} className={i === 0 ? "on" : ""}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                {path}
              </svg>
              {label}
            </div>
          ))}
        </nav>
        <div className="mc-scrim" ref={morph.scrimRef} data-morph-close hidden />
        <section className="mc-sheet" ref={morph.sheetRef} role="dialog" aria-modal="true" aria-labelledby={`${uid}-route`} hidden>
          <div className="mc-sheet-scroll">
            <button className="mc-back" type="button" data-morph-close data-morph-stagger data-morph-focus>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
              Back
            </button>
            <header className="mc-head">
              <div className="mc-route" id={`${uid}-route`} data-morph="route">
                {d ? <Route d={d} /> : null}
              </div>
              <div className="mc-party" data-morph="party">
                {d?.company}
              </div>
              <div className="mc-row">
                <span className="mc-ref" data-morph="ref">
                  {d ? `#${d.id} · ${d.date}` : null}
                </span>
                <span className={`mc-badge ${d?.status ?? ""}`} data-morph="badge">
                  {d?.label}
                </span>
              </div>
            </header>
            <div className="mc-block" data-morph-stagger>
              <h3>Progress</h3>
              <div className="mc-stages">
                {stages.map((s, i) => (
                  <div key={s} className={d && i <= d.stage ? "done" : ""} />
                ))}
              </div>
              <div className="mc-stage-labels">
                {stages.map((s, i) => (
                  <span key={s} className={d && i === d.stage ? "on" : ""}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="mc-block" data-morph-stagger>
              <h3>Stops</h3>
              <div>
                {d?.stops.map(([time, kind, place], i) => (
                  <div className="mc-stop" key={`${time}-${kind}`}>
                    <time>{time}</time>
                    <div>
                      <b>{kind}</b>
                      <small>{place}</small>
                    </div>
                    <span className={`mc-pill${i < d.stage ? " ok" : ""}`}>{i < d.stage ? "Done" : "Planned"}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mc-block" data-morph-stagger>
              <h3>Cargo</h3>
              <dl className="mc-kv">
                <dt>Cargo</dt>
                <dd>{d?.cargo}</dd>
                <dt>Weight</dt>
                <dd>{d?.weight}</dd>
                <dt>Vehicle</dt>
                <dd>{d?.vehicle}</dd>
              </dl>
            </div>
          </div>
          <footer className="mc-actions" data-morph-dock>
            <button className="mc-pill" type="button">
              Share
            </button>
            <button className="mc-pill" type="button">
              Track
            </button>
            <button className="mc-pill primary" type="button">
              Call driver
            </button>
          </footer>
        </section>
      </div>
      {controls ? (
        <div className="mc-controls">
          {!options ? (
            <>
              <Toggle on={slow} onClick={() => setSlow((v) => !v)}>
                4× slower
              </Toggle>
              <Toggle on={reduce} onClick={() => setReduce((v) => !v)}>
                Reduced motion
              </Toggle>
            </>
          ) : null}
          <StateLabel state={morph.state} />
        </div>
      ) : null}
    </div>
  );
}

/** As wide as its longest value ("closing"), so the row never reflows while the demo animates. */
export function StateLabel({ state }: { state: string }) {
  return (
    <span className="mc-state">
      <span aria-hidden="true" className="is-sizer">
        state: <code>closing</code>
      </span>
      <span aria-live="polite">
        state: <code>{state}</code>
      </span>
    </span>
  );
}

export function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="mc-toggle">
      {children}
    </button>
  );
}
