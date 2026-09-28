import { useState } from "react";
import { useMorph } from "morphcard/react";

type Delivery = { id: string; route: string; company: string; status: string };

export function Deliveries({ items }: { items: Delivery[] }) {
  const morph = useMorph();
  const [item, setItem] = useState<Delivery | null>(null);

  return (
    <>
      <main ref={morph.backgroundRef} className="list">
        {items.map((d) => (
          <article key={d.id} className="card">
            <button
              type="button"
              aria-label={`Open ${d.route}`}
              onClick={(e) => morph.open(e.currentTarget.closest("article"), () => setItem(d))}
            />
            <h3 data-morph="route">{d.route}</h3>
            <p data-morph="company">{d.company}</p>
            <span className="badge" data-morph="status">{d.status}</span>
            <p className="meta">Tap for stops and cargo</p>
          </article>
        ))}
      </main>

      <div ref={morph.scrimRef} className="scrim" data-morph-close hidden />

      <section ref={morph.sheetRef} className="sheet" role="dialog" aria-modal="true" aria-label="Delivery" hidden>
        <button type="button" data-morph-close data-morph-focus data-morph-stagger>
          Back
        </button>
        {item && (
          <>
            <header>
              <h1 data-morph="route">{item.route}</h1>
              <p data-morph="company">{item.company}</p>
              <span className="badge" data-morph="status">{item.status}</span>
            </header>
            <div data-morph-stagger>Stops</div>
            <div data-morph-stagger>Cargo</div>
          </>
        )}
      </section>
    </>
  );
}
