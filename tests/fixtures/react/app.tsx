// React fixture for the browser tests: the deliveries list driven by
// useMorph. Built by tsdown.fixtures.config.ts, in StrictMode and React's
// development build.
//
//   ?mode=keyed   cards open with open({ key, item }) and the sheet shows morph.item
//   (default)     cards open with open(element, update), as in earlier versions
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { type UseMorphOptions, useMorph } from "../../../src/index";
import { deliveries } from "../../../examples/shared/data.js";

type Delivery = (typeof deliveries)[number];

const keyed = new URLSearchParams(location.search).get("mode") === "keyed";

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
  const [options, setOptions] = useState<UseMorphOptions>({});
  const morph = useMorph<Delivery>(options);
  const [legacy, setLegacy] = useState<Delivery | null>(null);
  const [renders, setRenders] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [sheetShown, setSheetShown] = useState(true);
  const item = keyed ? morph.item : legacy;
  useEffect(() => {
    const deep = new URLSearchParams(location.search).get("deep");
    if (!deep) return;
    const item = deliveries.find((d) => d.id === deep) ?? deliveries[0]!;
    void morph.open({ key: item.id, item }).then((result) => Object.assign(window, { autoOpenResult: result }));
    if (deep === "cancel") void morph.close();
  }, [morph.open, morph.close]);
  Object.assign(window, {
    reactMorph: morph,
    bump: () => setRenders((n) => n + 1),
    fixture: {
      deliveries,
      setOptions,
      show: setLegacy,
      remountList: () => setGeneration((n) => n + 1),
      hideSheet: () => setSheetShown(false),
    },
  });

  return (
    <div className="mc-demo is-page" data-renders={renders} data-options={JSON.stringify(options)}>
      <header className="mc-topbar">
        <div className="mc-brand">Relay (React)</div>
      </header>
      <main className="mc-screen" ref={morph.backgroundRef}>
        <h1>Deliveries</h1>
        <ul className="mc-list">
          {deliveries.map((d) => (
            // A new generation replaces every card element, as a refetch would.
            <li key={`${generation}-${d.id}`}>
              <article className="mc-card" data-id={d.id} data-generation={generation} ref={morph.cardRef(d.id)}>
                <button
                  className="mc-card-hit"
                  type="button"
                  aria-label={`Open delivery ${d.id}`}
                  onClick={(e) =>
                    keyed
                      ? morph.open({ key: d.id, item: d })
                      : morph.open(e.currentTarget.closest("article"), () => setLegacy(d))
                  }
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
      {sheetShown ? (
        <>
          <div className="mc-scrim" ref={morph.scrimRef} data-morph-close hidden />
          <section className="mc-sheet" ref={morph.sheetRef} role="dialog" aria-modal="true" aria-label="Delivery" hidden>
            <div className="mc-sheet-scroll">
              <button className="mc-back" type="button" data-morph-close data-morph-stagger data-morph-focus>
                Back
              </button>
              {item ? (
                <header className="mc-head" data-item={item.id}>
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
        </>
      ) : null}
      <output className="state">{morph.state}</output>
    </div>
  );
}

function Root() {
  const [mounted, setMounted] = useState(true);
  Object.assign(window, { unmountApp: () => setMounted(false) });
  return mounted ? <App /> : <p className="unmounted">Unmounted</p>;
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
