// The deliveries demo, in plain JavaScript, without a dependency on how
// morphcard is loaded: mountDemo takes createMorph as an argument.
// examples/shared/demo.js wires it to the built package; the docs site passes the
// source.
import { deliveries, findDelivery, stages } from "./data.js";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const ARROW =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 12h15M14 7l5 5-5 5"/></svg>';
const CHEVRON =
  '<svg class="mc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const BACK =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';

export const routeHtml = (d) =>
  `<span class="mc-leg">${esc(d.from)}<i>${esc(d.fc)}</i></span>${ARROW}<span class="mc-leg">${esc(d.to)}<i>${esc(d.tc)}</i></span>`;

const cardHtml = (d) => `
  <li>
    <article class="mc-card" data-id="${d.id}">
      <button class="mc-card-hit" type="button" aria-label="Open delivery ${d.id}, ${esc(d.from)} to ${esc(d.to)}"></button>
      <div class="mc-card-main">
        <div class="mc-route" data-morph="route">${routeHtml(d)}</div>
        <div class="mc-party" data-morph="party">${esc(d.company)}</div>
        <div class="mc-ref" data-morph="ref">#${d.id} · ${esc(d.date)}</div>
        <div class="mc-meta">${esc(d.meta)}</div>
      </div>
      <div class="mc-card-side">
        <span class="mc-badge ${d.status}" data-morph="badge">${esc(d.label)}</span>
        ${CHEVRON}
      </div>
    </article>
  </li>`;

let counter = 0;

const TABS = [
  ["Deliveries", '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'],
  ["Map", '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>'],
  ["Inbox", '<path d="M4 13h4l2 3h4l2-3h4M5 5h14l1 8v6H4v-6z"/>'],
  ["Account", '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'],
];

function template({ uid }) {
  return `
  <header class="mc-topbar">
    <div class="mc-logo" aria-hidden="true">R</div><div class="mc-brand">Relay</div>
    <nav class="mc-topnav" aria-label="Sections"><span class="on">Deliveries</span><span>Map</span><span>Inbox</span></nav>
    <div class="mc-avatar" aria-hidden="true">JD</div>
  </header>
  <main class="mc-screen">
    <h1>Deliveries</h1>
    <p class="mc-sub">This week · ${deliveries.length} deliveries</p>
    <div class="mc-search">Search deliveries</div>
    <div class="mc-filters"><span class="on">All ${deliveries.length}</span><span>Scheduled</span><span>In transit</span><span>Delivered</span></div>
    <ul class="mc-list">${deliveries.map(cardHtml).join("")}</ul>
  </main>
  <nav class="mc-tabbar" aria-label="Tabs">
    ${TABS.map(([label, path], i) => `<div class="${i === 0 ? "on" : ""}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${path}</svg>${label}</div>`).join("")}
  </nav>
  <div class="mc-scrim" data-morph-close></div>
  <section class="mc-sheet" role="dialog" aria-modal="true" aria-labelledby="${uid}-route">
    <div class="mc-sheet-scroll">
      <button class="mc-back" type="button" data-morph-close data-morph-stagger data-morph-focus>${BACK}Back</button>
      <header class="mc-head">
        <div class="mc-route" id="${uid}-route" data-morph="route"></div>
        <div class="mc-party" data-morph="party"></div>
        <div class="mc-row"><span class="mc-ref" data-morph="ref"></span><span class="mc-badge" data-morph="badge"></span></div>
      </header>
      <div class="mc-block" data-morph-stagger>
        <h3>Progress</h3>
        <div class="mc-stages" data-slot="stages"></div>
        <div class="mc-stage-labels" data-slot="stage-labels"></div>
      </div>
      <div class="mc-block" data-morph-stagger>
        <h3>Stops</h3>
        <div data-slot="stops"></div>
      </div>
      <div class="mc-block" data-morph-stagger>
        <h3>Cargo</h3>
        <dl class="mc-kv" data-slot="cargo"></dl>
      </div>
    </div>
    <footer class="mc-actions" data-morph-dock>
      <button class="mc-pill" type="button">Share</button>
      <button class="mc-pill" type="button">Track</button>
      <button class="mc-pill primary" type="button">Call driver</button>
    </footer>
  </section>`;
}

export function fillSheet(sheet, d) {
  const q = (sel) => sheet.querySelector(sel);
  const slot = (name) => sheet.querySelector(`[data-slot="${name}"]`);
  const route = q('.mc-head [data-morph="route"]');
  if (route) route.innerHTML = routeHtml(d);
  const party = q('.mc-head [data-morph="party"]');
  if (party) party.textContent = d.company;
  const ref = q('.mc-head [data-morph="ref"]');
  if (ref) ref.textContent = `#${d.id} · ${d.date}`;
  const badge = q('.mc-head [data-morph="badge"]');
  if (badge) {
    badge.className = `mc-badge ${d.status}`;
    badge.textContent = d.label;
  }
  slot("stages").innerHTML = stages.map((_, i) => `<div class="${i <= d.stage ? "done" : ""}"></div>`).join("");
  slot("stage-labels").innerHTML = stages
    .map((label, i) => `<span class="${i === d.stage ? "on" : ""}">${esc(label)}</span>`)
    .join("");
  slot("stops").innerHTML = d.stops
    .map(
      ([time, kind, place], i) =>
        `<div class="mc-stop"><time>${esc(time)}</time><div><b>${esc(kind)}</b><small>${esc(place)}</small></div><span class="mc-pill${i < d.stage ? " ok" : ""}">${i < d.stage ? "Done" : "Planned"}</span></div>`,
    )
    .join("");
  slot("cargo").innerHTML = `<dt>Cargo</dt><dd>${esc(d.cargo)}</dd><dt>Weight</dt><dd>${esc(d.weight)}</dd><dt>Vehicle</dt><dd>${esc(d.vehicle)}</dd>`;
}

/**
 * Renders the demo into `root` and wires it to morphcard.
 * layout: "page" (the window scrolls) or "frame" (a box whose list scrolls).
 * Any other option is passed to createMorph.
 */
export function mountDemo(createMorph, root, options = {}) {
  const { layout = "page", wide, dark = false, ...morphOptions } = options;
  const uid = `mc${++counter}`;
  root.classList.add("mc-demo", `is-${layout}`);
  if (dark) root.classList.add("is-dark");
  root.innerHTML = template({ uid });

  const sheet = root.querySelector(".mc-sheet");
  const scrim = root.querySelector(".mc-scrim");
  const screen = root.querySelector(".mc-screen");
  const list = root.querySelector(".mc-list");

  const measureWide = () => {
    const width = layout === "page" ? document.documentElement.clientWidth : root.clientWidth;
    root.classList.toggle("is-wide", wide ?? width >= 768);
  };
  measureWide();
  addEventListener("resize", measureWide);

  let deepLink = null;
  const morph = createMorph({
    sheet,
    background: screen,
    scrim,
    prepare(card) {
      const id = card?.dataset.id ?? deepLink;
      deepLink = null;
      const d = findDelivery(id);
      if (d) fillSheet(sheet, d);
    },
    ...morphOptions,
  });

  list.addEventListener("click", (event) => {
    const card = event.target.closest(".mc-card");
    if (card) morph.open(card);
  });

  const card = (id) => list.querySelector(`.mc-card[data-id="${id}"]`);
  return {
    root,
    morph,
    sheet,
    scrim,
    screen,
    list,
    card,
    open: (id) => morph.open(card(id)),
    /** Opens without a card, as a deep link would. */
    openDirect(id) {
      deepLink = id;
      return morph.open(null);
    },
    close: (opts) => morph.close(opts),
    destroy() {
      removeEventListener("resize", measureWide);
      morph.destroy();
    },
  };
}
