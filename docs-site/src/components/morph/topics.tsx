import type { ReactNode } from "react";

const icon = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export interface Topic {
  slug: string;
  kicker: string;
  title: string;
  icon: ReactNode;
  summary: string;
  lead: string;
  points: string[];
}

export const topics: Topic[] = [
  {
    slug: "getting-started",
    kicker: "Start",
    title: "Getting started",
    icon: icon("M5 12h14M13 6l6 6-6 6"),
    summary: "Install from GitHub, add three elements, call useMorph.",
    lead: "A list, a sheet and an optional scrim. Mark what should fly with data-morph and open the sheet from a card.",
    points: [
      "useMorph() gives you three refs, the state, and open(card, update).",
      "update runs before anything is measured, so set the selected item there.",
      "Keep the sheet mounted and add [hidden] { display: none !important } to your CSS.",
    ],
  },
  {
    slug: "playground",
    kicker: "Try it",
    title: "Playground",
    icon: icon("M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"),
    summary: "Change duration, easing, stagger and speed, then click the tiles.",
    lead: "The controls change the options of the hooks on that page, so the tiles and the phone demo show exactly what those options do.",
    points: [
      "Open and close durations, surface and content easing, stagger.",
      "Background scale on or off, 4x slow motion, reduced motion.",
      "Copy the useMorph call for your own code.",
    ],
  },
  {
    slug: "api",
    kicker: "Reference",
    title: "API reference",
    icon: icon("M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"),
    summary: "Every option of useMorph, what it returns, and the data attributes.",
    lead: "One hook and six data attributes. Options passed to useMorph apply from the next transition.",
    points: [
      "duration { open: 400, close: 300 }, stagger 45, backgroundScale 0.96, timeScale 1.",
      "open(card, update) and close() return promises that resolve once the state is reached.",
      "state is one of closed, opening, open and closing, and re-renders your component.",
    ],
  },
  {
    slug: "anatomy",
    kicker: "How it works",
    title: "Anatomy",
    icon: icon("M3 12h4l3-8 4 16 3-8h4"),
    summary: "What moves when, with every duration and easing.",
    lead: "The surface clip opens, shared elements fly, the card's leftovers fade, content ripples in, the list recedes.",
    points: [
      "Surface and flights: 0 to 400 ms on cubic-bezier(0.32, 0.72, 0, 1).",
      "Content from 130 ms, 45 ms apart, rising 10 px.",
      "Back: 300 ms, and the big heading gives way within the first 90 ms.",
    ],
  },
  {
    slug: "interruptions",
    kicker: "How it works",
    title: "Interruptions",
    icon: icon("M3 12a9 9 0 1 0 3-6.7M3 4v5h5"),
    summary: "Back during an open turns the same animations around.",
    lead: "Nothing restarts. The running animations are seeked to one clock and played backwards from where they are.",
    points: [
      "Four states: closed, opening, open, closing.",
      "A generation counter: an older run can never clean up a newer one.",
      "After any sequence the DOM is exactly as it was before the first open.",
    ],
  },
  {
    slug: "accessibility",
    kicker: "How it works",
    title: "Accessibility",
    icon: icon("M12 4a1.5 1.5 0 1 0 0 .01M5 8l7 1 7-1M12 9v5l-3 6M12 14l3 6"),
    summary: "Reduced motion is opacity only. Focus goes in and comes back.",
    lead: "With prefers-reduced-motion nothing moves: the surface fades, then the content, so two screens never overlap.",
    points: [
      "Focus moves to data-morph-focus on open and back to the card on close, without scrolling.",
      "Escape closes. The list behind is inert while the sheet is open.",
      "The temporary card copy is aria-hidden and inert, and only exists mid-transition.",
    ],
  },
  {
    slug: "pitfalls",
    kicker: "How it works",
    title: "Pitfalls",
    icon: icon("M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"),
    summary: "Seven bugs from a real app, each now a rule and a test.",
    lead: "Every rule here came from a bug seen in production with a shared-element transition, and each has a browser test.",
    points: [
      "No flight to a destination that is missing or off screen.",
      "No flight from a card that is off screen.",
      "Never transform a container that has position: fixed children.",
    ],
  },
  {
    slug: "recipes",
    kicker: "Guides",
    title: "Recipes",
    icon: icon("M4 4h16v16H4zM4 9h16M9 20V9"),
    summary: "List to detail with a URL, a photo gallery, a wallet card.",
    lead: "Three setups that differ from the basic list: routing, images that scale by width, and a same-colour card.",
    points: [
      "Deep links open without a flight, and the browser's Back button closes.",
      "Images fly by width and crossfade when the aspect ratio changes.",
      "A card and sheet of the same colour only change shape.",
    ],
  },
  {
    slug: "view-transitions",
    kicker: "Guides",
    title: "vs View Transitions",
    icon: icon("M7 7h10v10H7zM3 3h4M3 3v4M21 21h-4M21 21v-4"),
    summary: "When the browser API is enough and when it is not.",
    lead: "View Transitions snapshot the page and cross-fade images. react-morphcard animates the live DOM, so it can be interrupted.",
    points: [
      "Same-document view transitions: Chrome and Edge 111, Safari 18, Firefox 144.",
      "react-morphcard keeps the page interactive and reverses mid-flight.",
      "Use View Transitions for page-level swaps between routes.",
    ],
  },
];
