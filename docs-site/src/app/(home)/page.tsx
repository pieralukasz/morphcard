import Link from "next/link";
import type { ReactNode } from "react";
import { LiveDemo } from "@/components/live-demo";
import { CodeCard } from "@/components/morph/code-card";
import { FeatureTiles } from "@/components/morph/features";
import { HeroCards } from "@/components/morph/hero-cards";
import { VideoGrid, VideoTile } from "@/components/morph/video-tile";
import { authorUrl, install, repoUrl } from "@/lib/shared";

export default function HomePage() {
  return (
    <main className="flex flex-col">
      <section className="mc-glow">
        <div className="mx-auto w-full max-w-[880px] px-6 pt-12 pb-14">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-[2.75rem] sm:leading-[1.1]">
                A card that grows into a <span className="text-fd-primary">detail view</span> and shrinks back.
              </h1>
              <p className="mt-4 max-w-[60ch] text-lg text-fd-muted-foreground">
                react-morphcard is one React hook, <code className="text-fd-foreground">useMorph</code>. It works in
                desktop and mobile browsers, installed PWAs and WebViews. Every card on this site uses it.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:flex-col md:items-stretch">
              <Link
                href="/docs/getting-started"
                className="mc-press rounded-full bg-fd-primary px-6 py-2.5 text-center font-medium text-fd-primary-foreground"
              >
                Get started
              </Link>
              <a href={repoUrl} className="mc-press rounded-full border bg-fd-card px-6 py-2.5 text-center font-medium">
                GitHub
              </a>
            </div>
          </div>
          <p className="mch-hint mt-8">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 11V5a2 2 0 0 1 4 0v6M13 10a2 2 0 0 1 4 0v1M17 11a2 2 0 0 1 4 0v4a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L5 15a2 2 0 0 1 3-2.6l1 1.1" />
            </svg>
            <span>
              Click a card. <kbd>Esc</kbd>, Back or a click outside shrinks it back.
            </span>
          </p>
          <HeroCards />
        </div>
      </section>

      <Section eyebrow="What it does" title="The details that make it feel native">
        <p className="-mt-4 mb-6 text-fd-muted-foreground">Each tile opens the same way the cards above do.</p>
        <FeatureTiles />
      </Section>

      <Section eyebrow="Recordings" title="Slowed down to a quarter speed">
        <p className="-mt-4 mb-6 text-fd-muted-foreground">
          Recorded frame by frame from the demo app. A tile grows into a player, and Back shrinks it into the tile.
        </p>
        <VideoGrid>
          <VideoTile name="open-close" title="Open and back" badge="4× slower" caption="Open, hold, back. Recorded frame by frame, played four times slower." />
          <VideoTile name="interrupt" title="Back mid-flight" badge="4× slower" caption="Back pressed 150 ms into the open. The same animations turn around." />
          <VideoTile name="reduced" themed={false} title="Reduced motion" badge="4× slower" caption="With prefers-reduced-motion the sheet and content only fade." />
          <VideoTile name="desktop" slow={false} width={1280} height={800} title="On a desktop" badge="1×" caption="A 1280 × 800 layout at normal speed." />
        </VideoGrid>
      </Section>

      <Section eyebrow="Usage" title="Three refs and one call">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <code className="rounded-lg border bg-fd-card px-3 py-2 text-sm">{install}</code>
          <span className="text-sm text-fd-muted-foreground">React 18 or 19. No other dependencies.</span>
        </div>
        <div className="mcs-grid is-code">
          <CodeCard
            file="deliveries.tsx"
            note="A list of cards and one sheet. The card's route, company and status fly into the header."
            previewLines={9}
          >
            <p>
              <code>open(card, update)</code> runs <code>update</code> before it measures anything, so the sheet
              already shows the item that was clicked. Elements with the same <code>data-morph</code> key on the card
              and in the sheet fly between the two.
            </p>
          </CodeCard>
          <CodeCard file="sheet.css" note="The sheet and scrim are positioned over the list and hidden while closed." previewLines={9} />
        </div>
        <p className="mt-5 text-fd-muted-foreground">
          The{" "}
          <Link className="underline" href="/docs/getting-started">
            getting started guide
          </Link>{" "}
          walks through it step by step, and the{" "}
          <Link className="underline" href="/docs/playground">
            playground
          </Link>{" "}
          lets you change the timing on this site.
        </p>
      </Section>

      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <div className="grid items-center gap-10 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_390px]">
          <div>
            <p className="text-sm font-semibold text-fd-primary">Same hook, small screen</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">In a mobile app or PWA</h2>
            <p className="mt-4 text-fd-muted-foreground">
              On a phone the sheet usually covers the whole screen under the app bar. This frame is a small deliveries
              app built with the same hook. Its list scrolls inside the frame, the tab bar stays put, and the action
              bar slides up from the bottom.
            </p>
            <p className="mt-3 text-fd-muted-foreground">
              Slow it down to see the order: the surface opens, the route and company fly, the stops come in one after
              another. Reduced motion turns all of it into a fade.
            </p>
            <p className="mt-3 text-fd-muted-foreground">
              It runs in any browser engine React DOM runs in, including installed PWAs and WebViews. It is not for
              React Native.
            </p>
          </div>
          <LiveDemo />
        </div>
      </section>

      <footer className="border-t py-10 text-center text-sm text-fd-muted-foreground">
        <p>
          Made by{" "}
          <a className="font-medium text-fd-foreground underline underline-offset-4" href={authorUrl}>
            Lucas Piera
          </a>
          . MIT licensed.{" "}
          <a className="underline" href={repoUrl}>
            Source on GitHub
          </a>
          .
        </p>
      </footer>
    </main>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-[880px] px-6 py-14">
      <p className="text-sm font-semibold text-fd-primary">{eyebrow}</p>
      <h2 className="mt-2 mb-8 text-3xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
