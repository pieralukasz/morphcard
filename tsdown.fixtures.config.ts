import { type UserConfig, defineConfig } from "tsdown";

// Browser bundles for the example page and the tests, React included, so
// they load without an import map for React.
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
    // The package as one file, for examples/index.html.
    ...browser,
    entry: { morphcard: "src/index.ts" },
    outDir: "examples/dist",
    clean: true,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
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
