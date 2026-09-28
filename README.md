# react-morphcard

A React hook for a card that grows into a full detail screen and shrinks back. The card's title, name and badge fly into the header, the content settles in, and Back plays a shorter version that ends on the card.

<p align="center">
  <img src="docs-site/public/videos/demo.gif" width="320" alt="A delivery card growing into its detail screen and shrinking back, at half speed">
</p>

**Docs and live demo: [morphcard.lucaspiera.com](https://morphcard.lucaspiera.com)**

- One hook, `useMorph`. No components, no context provider, no dependencies besides React 18 or 19.
- Works in any modern browser, in installed PWAs and in WebViews. It does not work in React Native, because it animates DOM elements with the Web Animations API.
- The detail screen opens by `clip-path` from the card's rectangle, so nothing stretches and `position: fixed` children stay put.
- Text that wraps differently on the card and in the header crossfades while it flies instead of scaling.
- Closing (300 ms) is quicker than opening (400 ms) and ends on the card.
- Closing during an open reverses the running animations from where they are.
- No flight when the card is off screen or the destination is missing. The sheet fades instead.
- Reduced motion is opacity only. Focus moves into the sheet and back to the card.
- Safe to import during server rendering. The built file starts with `"use client"` for the Next.js App Router.

## Install

```bash
pnpm add react-morphcard
# or
npm install react-morphcard
```

## Use

```tsx
import { useMorph } from "react-morphcard";

export function Deliveries({ items }: { items: Delivery[] }) {
  const morph = useMorph<Delivery>();
  const d = morph.item;

  return (
    <>
      <main ref={morph.backgroundRef}>
        {items.map((item) => (
          <article key={item.id} ref={morph.cardRef(item.id)} className="card">
            <button
              aria-label={`Open delivery ${item.id}`}
              onClick={() => morph.open({ key: item.id, item })}
            />
            <h3 data-morph="title">{item.title}</h3>
            <span data-morph="badge">{item.status}</span>
          </article>
        ))}
      </main>
      <div ref={morph.scrimRef} className="scrim" data-morph-close hidden />
      <section ref={morph.sheetRef} className="sheet" role="dialog" aria-label="Delivery" hidden>
        <button data-morph-close data-morph-focus>Back</button>
        {d && (
          <>
            <h1 data-morph="title">{d.title}</h1>
            <span data-morph="badge">{d.status}</span>
            <div data-morph-stagger>{d.cargo}</div>
          </>
        )}
      </section>
    </>
  );
}
```

```css
.sheet, .scrim { position: fixed; inset: 0; }
[hidden] { display: none !important; }
```

Elements with the same `data-morph` key on the card and in the sheet fly between each other. `morph.item` is set before anything is measured and cleared only after the sheet has closed, so the sheet keeps its content for the whole flight back. If you keep the selected item in your own state, pass an update instead: `morph.open(event.currentTarget, () => setItem(item))`.

See [Getting started](https://morphcard.lucaspiera.com/docs/getting-started) and the [API reference](https://morphcard.lucaspiera.com/docs/api).

## Develop

```bash
pnpm install
pnpm build          # dist/ with tsdown
pnpm typecheck
pnpm test           # builds dist, then unit tests (vitest), including an import of dist in plain Node
pnpm test:e2e       # browser tests (Playwright, Chromium, desktop and phone)
pnpm serve          # examples at http://127.0.0.1:3301/examples/index.html
```

The hook drives an internal engine in `src/morph.ts` that has no React in it. The package does not export it. `tsdown.fixtures.config.ts` builds it to `examples/dist/engine.js` for the plain JavaScript demo in `examples/` and for the engine tests.

The browser tests run at 1280×800 and 390×844. The engine tests cover open and close end states, reversing mid-transition, rapid clicks, reduced motion, missing and off-screen targets, scroll restore, focus return and leftover DOM. The React tests use `tests/fixtures/react` in StrictMode. They check where the card lands, how long `item` lives, unmounting mid-animation, live option changes and keyed cards. `scripts/record.mjs` records a transition frame by frame and `scripts/make-videos.sh` builds the videos used by the docs.

The docs site lives in `docs-site/` (Fumadocs, static export).

## Publishing

`package.json` is ready for npm (`exports`, types, `files`; `prepublishOnly` runs the typecheck, the build and the unit tests). Publishing is one command: `pnpm publish`.

## License

MIT © Łukasz Piera
