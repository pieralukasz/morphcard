"use client";
/**
 * The home page hero: six example cards that open into the page's sheet.
 * They are ordinary page content, not a device mockup, so on a desktop the
 * first thing you can click is the library working on this site.
 */
import { useStage } from "./stage";
import { Arrow } from "./tile";

interface Trip {
  id: string;
  city: string;
  country: string;
  when: string;
  tag: string;
  saved: string;
  hue: number;
  glyph: string;
  about: string;
  days: string[];
}

const trips: Trip[] = [
  {
    id: "lisbon",
    city: "Lisbon",
    country: "Portugal",
    when: "4 days · April",
    tag: "Walking",
    saved: "12 saved places",
    hue: 24,
    glyph: "M3 17h18M5 17V9l4-3 4 3v8M13 17v-5h6v5M8 11h2",
    about: "Seven hills, trams and long lunches. Most of it is walkable if you do not mind stairs.",
    days: ["Alfama and the castle", "Belém by the river", "Sintra day trip", "LX Factory and a sunset at Adamastor"],
  },
  {
    id: "kyoto",
    city: "Kyoto",
    country: "Japan",
    when: "5 days · November",
    tag: "Temples",
    saved: "18 saved places",
    hue: 350,
    glyph: "M4 8h16M6 8l-2 3M18 8l2 3M7 8v10M17 8v10M5 13h14M10 18v-5M14 18v-5",
    about: "Autumn leaves in the temple gardens, early starts to beat the crowds, and a lot of tofu.",
    days: ["Fushimi Inari at 7 am", "Arashiyama bamboo and Tenryū-ji", "Nishiki market", "Philosopher's Path", "Day trip to Nara"],
  },
  {
    id: "reykjavik",
    city: "Reykjavík",
    country: "Iceland",
    when: "6 days · February",
    tag: "Road trip",
    saved: "9 saved places",
    hue: 200,
    glyph: "M3 18l6-9 4 6 3-4 5 7zM16 6a2 2 0 1 0 0 .01",
    about: "Short days, long drives and a fair chance of northern lights. Rent a car with studded tyres.",
    days: ["Golden Circle", "South coast to Vík", "Glacier lagoon", "Snæfellsnes peninsula", "Hot springs", "City and harbour"],
  },
  {
    id: "oaxaca",
    city: "Oaxaca",
    country: "Mexico",
    when: "5 days · October",
    tag: "Food",
    saved: "21 saved places",
    hue: 140,
    glyph: "M12 3c3 3 5 6 5 9a5 5 0 0 1-10 0c0-3 2-6 5-9zM12 21v-4",
    about: "Markets, mole and mezcal, with day trips to ruins and weaving villages in the valleys.",
    days: ["Mercado 20 de Noviembre", "Monte Albán", "Hierve el Agua", "Teotitlán del Valle", "Cooking class"],
  },
  {
    id: "tromso",
    city: "Tromsø",
    country: "Norway",
    when: "3 days · January",
    tag: "Aurora",
    saved: "6 saved places",
    hue: 262,
    glyph: "M3 16c4-6 6-9 9-9s5 3 9 9M3 20h18",
    about: "Polar night, fjords and the cable car above the town. Evenings go to aurora forecasts.",
    days: ["Fjellheisen cable car", "Fjord cruise", "Aurora chase on the coast"],
  },
  {
    id: "marrakesh",
    city: "Marrakesh",
    country: "Morocco",
    when: "4 days · March",
    tag: "Markets",
    saved: "14 saved places",
    hue: 8,
    glyph: "M5 20V10a7 7 0 0 1 14 0v10M9 20v-6a3 3 0 0 1 6 0v6M3 20h18",
    about: "The medina, riad courtyards and the Atlas mountains an hour away.",
    days: ["Jemaa el-Fna and the souks", "Jardin Majorelle", "Atlas mountains", "Hammam and rooftops"],
  },
];

function Cover({ trip, large }: { trip: Trip; large?: boolean }) {
  return (
    <div
      className={`mch-cover${large ? " is-large" : ""}`}
      data-morph="cover"
      data-morph-mode="box"
      style={{ ["--h" as string]: trip.hue }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={trip.glyph} />
      </svg>
    </div>
  );
}

export function HeroCards() {
  const stage = useStage();
  return (
    <ul className="mch-grid">
      {trips.map((t) => (
        <li key={t.id}>
          <article className="mcs-tile mch-card" data-id={t.id}>
            <button
              type="button"
              className="mcs-hit"
              aria-label={`Open ${t.city}, ${t.when}`}
              onClick={(e) =>
                stage.open(e.currentTarget.parentElement, {
                  label: `${t.city}, ${t.country}`,
                  kind: "hero",
                  render: () => <TripSheet trip={t} />,
                })
              }
            />
            <Cover trip={t} />
            <div className="mch-text">
              <div className="mch-row">
                <h3 className="mch-city" data-morph="city">
                  {t.city}
                </h3>
                <span className="mcs-badge" data-morph="tag">
                  {t.tag}
                </span>
              </div>
              <p className="mch-when" data-morph="when">
                {t.when}
              </p>
              <p className="mch-saved">
                {t.saved}
                <Arrow />
              </p>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

function TripSheet({ trip }: { trip: Trip }) {
  return (
    <>
      <Cover trip={trip} large />
      <header className="mch-head">
        <div className="mch-row">
          <h2 className="mch-city is-large" data-morph="city">
            {trip.city}
          </h2>
          <span className="mcs-badge" data-morph="tag">
            {trip.tag}
          </span>
        </div>
        <p className="mch-when is-large" data-morph="when">
          {trip.when} · {trip.country}
        </p>
      </header>
      <p className="mcs-lead" data-morph-stagger>
        {trip.about}
      </p>
      <ol className="mch-days" data-morph-stagger>
        {trip.days.map((d, i) => (
          <li key={d}>
            <span>Day {i + 1}</span>
            {d}
          </li>
        ))}
      </ol>
      <aside className="mcs-note" data-morph-stagger>
        <b>What you just saw.</b> The cover, the city, the dates and the tag carry the same <code>data-morph</code> key
        on the card and here, so they flew. “{trip.saved}” is only on the card, so it faded. The panel itself started as
        the card's rectangle and its clip opened. Press Esc, click outside, or use Back: it plays in reverse and lands on
        the card.
      </aside>
    </>
  );
}
