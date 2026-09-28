// The deliveries demo wired to the built package. Used by
// examples/index.html and the browser tests; `morphcard` resolves through
// the page's import map.
import { createMorph } from "morphcard";
import { mountDemo as mount } from "./demo-app.js";

export { fillSheet, routeHtml } from "./demo-app.js";

export function mountDemo(root, options) {
  return mount(createMorph, root, options);
}
