import { defineConfig } from "tsdown";

// Bundles the React test fixture (React included) for the browser tests.
export default defineConfig({
  entry: { app: "tests/fixtures/react/app.tsx" },
  outDir: "tests/fixtures/react/dist",
  format: "esm",
  platform: "browser",
  target: "es2022",
  dts: false,
  clean: true,
  sourcemap: false,
  fixedExtension: false,
  deps: { alwaysBundle: [/.*/] },
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
});
