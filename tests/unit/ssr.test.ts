// The built package in plain Node, as during server rendering (Next.js,
// Remix): importing and rendering it must not touch window or document.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const dist = `${root}dist/index.js`;

// Runs in a separate Node process: no DOM, no test runner transforms.
const script = `
import { createElement } from "react";
import { renderToString } from "react-dom/server";
const m = await import("./dist/index.js");
function Page() {
  const morph = m.useMorph();
  return createElement("div", null,
    createElement("main", { ref: morph.backgroundRef },
      createElement("article", { ref: morph.cardRef("a") }, "card")),
    createElement("section", { ref: morph.sheetRef, hidden: true }, String(morph.item)),
    createElement("output", null, morph.state));
}
console.log(JSON.stringify({
  window: typeof window,
  document: typeof document,
  exports: Object.keys(m).sort(),
  html: renderToString(createElement(Page)),
}));
`;

describe("dist in Node without a DOM", () => {
  beforeAll(() => {
    if (!existsSync(dist)) throw new Error("dist/index.js is missing: run `pnpm build` first");
  });

  it("starts with the use client directive", () => {
    expect(readFileSync(dist, "utf8").split("\n")[0]).toBe('"use client";');
  });

  it("imports and renders on the server without throwing", () => {
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], { cwd: root, encoding: "utf8" });
    expect(JSON.parse(out)).toEqual({
      window: "undefined",
      document: "undefined",
      exports: ["choreography", "defaults", "useMorph"],
      html: '<div><main><article>card</article></main><section hidden="">null</section><output>closed</output></div>',
    });
  });

  it("publishes the hook entry only", () => {
    const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));
    expect(pkg.name).toBe("react-morphcard");
    expect(Object.keys(pkg.exports)).toEqual([".", "./package.json"]);
    expect(pkg.files).toEqual(["dist"]);
    expect(readFileSync(dist, "utf8")).not.toMatch(/export \{[^}]*createMorph/);
  });
});
