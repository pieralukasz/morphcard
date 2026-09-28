// The deliveries demo wired to the internal engine (src/morph.ts, built to
// examples/dist/engine.js). Used by examples/index.html and the browser
// tests; `morphcard-engine` resolves through the page's import map. The
// engine is not part of the published package.
import { createMorph } from "morphcard-engine";
import { mountDemo as mount } from "./demo-app.js";

export { fillSheet, routeHtml } from "./demo-app.js";

export function mountDemo(root, options) {
  return mount(createMorph, root, options);
}
