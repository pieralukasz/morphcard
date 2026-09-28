import Link from "next/link";
import type { ReactNode } from "react";
import { LiveDemo } from "@/components/live-demo";
import { Video } from "@/components/video";
import { authorUrl, repoUrl } from "@/lib/shared";

const install = "pnpm add github:pieralukasz/morphcard";

const points = [
  {
    title: "One surface that opens",
    text: "The detail screen is clipped to the card's shape and the clip opens to full screen. Nothing is scaled, so text and images never stretch.",
  },
  {
    title: "Shared text flies, the rest fades",
    text: "Mark the route, name or badge with data-morph and they travel from the card to the header. Text that wraps differently crossfades instead of stretching.",
  },
  {
    title: "Closing has its own timing",
    text: "Back takes 300 ms against 400 ms to open. The big heading hands over to the card text early, so the last thing moving is the card itself.",
  },
  {
    title: "Interruptible",
    text: "Tap back while it opens and the same animations turn around from where they are. No jump, no second copy, no leftover styles.",
  },
  {
    title: "Knows when not to fly",
    text: "If the card is off screen or the target is missing, it crossfades instead of sending a lonely heading across an unrelated page.",
  },
  {
    title: "Small and plain",
    text: "TypeScript, no runtime dependencies, Web Animations API. An optional React hook. Reduced motion becomes an opacity-only fade.",
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-col">
      <section className="mc-glow">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-16 pb-16 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="max-w-xl">
            <span className="mb-5 inline-block rounded-full border bg-fd-card px-3 py-1 text-xs font-medium text-fd-muted-foreground">
              Open source · MIT · No dependencies
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              A card that grows into a{" "}
              <span className="text-fd-primary">detail screen</span> and shrinks
              back.
            </h1>
            <p className="mt-5 text-lg text-fd-muted-foreground">
              morphcard animates the list-to-detail transition: the card
              becomes the screen, its title flies into the header, the content
              settles in, and back plays a shorter, calmer version. Try it on the
              right.
            </p>
            <pre className="mt-6 overflow-x-auto rounded-xl border bg-fd-card px-4 py-3 text-sm">
              <code>{install}</code>
            </pre>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/docs"
                className="rounded-full bg-fd-primary px-6 py-3 font-medium text-fd-primary-foreground transition hover:opacity-90"
              >
                Get started
              </Link>
              <a
                href={repoUrl}
                className="rounded-full border bg-fd-card px-6 py-3 font-medium transition hover:bg-fd-accent"
              >
                GitHub
              </a>
            </div>
          </div>
          <LiveDemo />
        </div>
      </section>

      <Section eyebrow="Slowed down" title="The same transition at a quarter speed">
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
          <Video
            name="open-close"
            caption="Open, hold, back. Recorded frame by frame, played four times slower."
            className="my-0"
          />
          <ol className="space-y-4 text-fd-muted-foreground">
            <li>
              <b className="text-fd-foreground">0 to 400 ms.</b> The sheet's
              clip grows from the card to the full screen. The route, company,
              reference and badge fly to the header. The list behind scales to
              0.96 under a scrim.
            </li>
            <li>
              <b className="text-fd-foreground">From 130 ms.</b> Content blocks
              rise 10 px and fade in, 45 ms apart. The action bar slides up.
            </li>
            <li>
              <b className="text-fd-foreground">Back, 300 ms.</b> The heading
              gives way to the card's own text within the first 90 ms. The
              card's meta line fades back in over the second half, ending with
              the list.
            </li>
          </ol>
        </div>
      </Section>

      <Section eyebrow="What it does" title="The details that make it feel native">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {points.map((p) => (
            <div key={p.title} className="rounded-2xl border bg-fd-card p-6">
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-fd-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Usage" title="Three elements and one call">
        <pre className="overflow-x-auto rounded-2xl border bg-fd-card p-5 text-sm leading-relaxed">
          <code>{`import { createMorph } from "morphcard";

const morph = createMorph({
  sheet: document.querySelector(".sheet"),     // the detail screen
  background: document.querySelector(".list"), // recedes behind it
  scrim: document.querySelector(".scrim"),     // optional dimmer
  prepare: (card) => fillSheet(card.dataset.id),
});

list.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) morph.open(card);
});
// <button data-morph-close> inside the sheet closes it.`}</code>
        </pre>
        <p className="mt-4 text-fd-muted-foreground">
          Put <code>data-morph=&quot;title&quot;</code> on the card&apos;s title
          and on the sheet&apos;s heading, and they fly between the two. The{" "}
          <Link className="underline" href="/docs/getting-started">
            getting started guide
          </Link>{" "}
          has the full markup and the React version.
        </p>
      </Section>

      <footer className="border-t py-10 text-center text-sm text-fd-muted-foreground">
        <p>
          Made by{" "}
          <a
            className="font-medium text-fd-foreground underline underline-offset-4"
            href={authorUrl}
          >
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

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold text-fd-primary">{eyebrow}</p>
      <h2 className="mt-2 mb-8 text-3xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
