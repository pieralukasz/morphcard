// React fixture for the browser tests: the same deliveries list, driven by
// useMorph from morphcard/react. Built by tsdown.fixtures.config.ts.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useMorph } from "../../../src/react";
import { deliveries } from "../../../examples/shared/data.js";

type Delivery = (typeof deliveries)[number];

function Route({ d }: { d: Delivery }) {
  return (
    <>
      <span className="mc-leg">
        {d.from}
        <i>{d.fc}</i>
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 12h15M14 7l5 5-5 5" />
      </svg>
      <span className="mc-leg">
        {d.to}
        <i>{d.tc}</i>
      </span>
    </>
  );
}

function App() {
  const morph = useMorph();
  const [item, setItem] = useState<Delivery | null>(null);
  const [renders, setRenders] = useState(0);
  Object.assign(window, { reactMorph: morph, bump: () => setRenders((n) => n + 1) });

  return (
    <div className="mc-demo is-page" data-renders={renders}>
      <header className="mc-topbar">
        <div className="mc-brand">Relay (React)</div>
      </header>
      <main className="mc-screen" ref={morph.backgroundRef}>
        <h1>Deliveries</h1>
        <ul className="mc-list">
          {deliveries.map((d) => (
            <li key={d.id}>
              <article className="mc-card" data-id={d.id}>
                <button
                  className="mc-card-hit"
                  type="button"
                  aria-label={`Open delivery ${d.id}`}
                  onClick={(e) => morph.open(e.currentTarget.closest("article"), () => setItem(d))}
                />
                <div className="mc-card-main">
                  <div className="mc-route" data-morph="route">
                    <Route d={d} />
                  </div>
                  <div className="mc-party" data-morph="party">
                    {d.company}
                  </div>
                  <div className="mc-ref" data-morph="ref">
                    #{d.id} · {d.date}
                  </div>
                  <div className="mc-meta">{d.meta}</div>
                </div>
                <div className="mc-card-side">
                  <span className={`mc-badge ${d.status}`} data-morph="badge">
                    {d.label}
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </main>
      <div className="mc-scrim" ref={morph.scrimRef} data-morph-close hidden />
      <section className="mc-sheet" ref={morph.sheetRef} role="dialog" aria-modal="true" aria-label="Delivery" hidden>
        <div className="mc-sheet-scroll">
          <button className="mc-back" type="button" data-morph-close data-morph-stagger data-morph-focus>
            Back
          </button>
          {item ? (
            <header className="mc-head">
              <div className="mc-route" data-morph="route">
                <Route d={item} />
              </div>
              <div className="mc-party" data-morph="party">
                {item.company}
              </div>
              <div className="mc-row">
                <span className="mc-ref" data-morph="ref">
                  #{item.id} · {item.date}
                </span>
                <span className={`mc-badge ${item.status}`} data-morph="badge">
                  {item.label}
                </span>
              </div>
            </header>
          ) : null}
          <div className="mc-block" data-morph-stagger>
            <h3>Cargo</h3>
            <p className="cargo">{item?.cargo}</p>
          </div>
        </div>
      </section>
      <output className="state">{morph.state}</output>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
