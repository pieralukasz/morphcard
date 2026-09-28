"use client";
/** The home page feature tiles. Each grows into a short explanation. */
import { MorphTile } from "./tile";

const i = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const features = [
  {
    kicker: "Surface",
    title: "One surface that opens",
    icon: i("M4 4h16v16H4zM9 9h6v6H9z"),
    summary: "The sheet is clipped to the card's shape and the clip opens. Nothing is scaled, so text stays sharp.",
    href: "/docs/anatomy",
    body: [
        <p>
          The sheet is always laid out at its final size. When it opens, its <code>clip-path</code> starts as the card's
          rectangle, with the card's corner radius, and grows to the whole sheet. Because nothing is scaled, the sheet's
          text is never stretched.
        </p>,
        <p>This panel opened the same way: its clip started as the tile you clicked.</p>
    ],
  },
  {
    kicker: "Shared elements",
    title: "Shared text flies, the rest fades",
    icon: i("M5 7h8M5 12h14M5 17h10"),
    summary: "Give the card's title and the sheet's heading the same data-morph key and they travel between the two.",
    href: "/docs/anatomy",
    body: [
        <p>
          Mark an element on the card and one in the sheet with the same key, for example{" "}
          <code>data-morph="title"</code>. The sheet's copy starts over the card's copy and moves to its own place.
        </p>,
        <p>
          When the two versions wrap differently, both fly together and crossfade, so the text is never squashed. The
          icon, kicker and title of this tile flew here.
        </p>
    ],
  },
  {
    kicker: "Timing",
    title: "Closing has its own timing",
    icon: i("M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"),
    summary: "Back takes 300 ms against 400 ms to open, and the big heading hands over to the card text early.",
    href: "/docs/anatomy",
    body: [
        <p>
          Opening takes 400 ms and closing 300 ms. On the way back the reader already knows where they are going, so the
          sheet heading fades in the first 90 ms and the card's own text is what lands on the card.
        </p>,
        <p>
          Both durations, the easing curves and the stagger are options. The <a href="/docs/playground">playground</a>{" "}
          changes them for every tile on its page.
        </p>
    ],
  },
  {
    kicker: "Interruptions",
    title: "Back works mid-flight",
    icon: i("M3 12a9 9 0 1 0 3-6.7M3 4v5h5"),
    summary: "Close while it opens and the same animations turn around from where they are.",
    href: "/docs/interruptions",
    body: [
        <p>
          A close during an open does not start a new animation. The running ones are put on one clock and played
          backwards, so nothing jumps and no second copy appears.
        </p>,
        <p>Try it: click a tile and press Esc straight away.</p>
    ],
  },
  {
    kicker: "Fallbacks",
    title: "Knows when not to fly",
    icon: i("M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"),
    summary: "If the card is off screen or the target is missing, the sheet fades instead of flying.",
    href: "/docs/pitfalls",
    body: [
        <p>
          A heading that flies across an unrelated page looks broken. Before every flight the hook checks that both ends
          are on screen. If one is not, that element fades in place, and without a card the whole sheet fades.
        </p>,
        <p>Each rule comes from a bug seen in a real app, and each has a browser test.</p>
    ],
  },
  {
    kicker: "Where it runs",
    title: "Desktop, phones, PWAs, WebViews",
    icon: i("M3 5h13v10H3zM7 19h5M18 8h3v11h-3z"),
    summary: "One React hook on the Web Animations API. Reduced motion becomes a fade.",
    href: "/docs/accessibility",
    body: [
        <p>
          It works wherever React DOM runs: desktop and mobile browsers, installed PWAs and WebViews. It does not support
          React Native.
        </p>,
        <p>
          With <code>prefers-reduced-motion</code> nothing moves: the sheet and its content fade. Focus goes to the
          sheet on open and back to the card on close.
        </p>
    ],
  },
];

export function FeatureTiles() {
  return (
    <div className="mcs-grid is-features">
      {features.map((f) => (
        <MorphTile
          key={f.title}
          kicker={f.kicker}
          title={f.title}
          icon={f.icon}
          summary={<p>{f.summary}</p>}
          detail={f.body}
          href={f.href}
          hrefLabel="Read more in the docs"
          more="Explain"
        />
      ))}
    </div>
  );
}
