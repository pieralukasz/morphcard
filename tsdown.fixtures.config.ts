import { type UserConfig, defineConfig } from "tsdown";

// Browser bundles for the example page and the tests, React included, so
// they load without an import map for React. None of this is published.
const browser: UserConfig = {
  format: "esm",
  platform: "browser",
  target: "es2022",
  dts: false,
  sourcemap: false,
  fixedExtension: false,
  deps: { alwaysBundle: [/.*/] },
};

export default defineConfig([
  {
    // The internal engine (src/morph.ts) as one file, for examples/index.html
    // and the gallery fixture. Pages load it as "morphcard-engine" through
    // an import map. It is not part of the package's exports.
    ...browser,
    entry: { engine: "src/morph.ts" },
    outDir: "examples/dist",
    clean: true,
  },
  {
    // The React test app.
    ...browser,
    entry: { app: "tests/fixtures/react/app.tsx" },
    outDir: "tests/fixtures/react/dist",
    clean: true,
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
  },
]);
