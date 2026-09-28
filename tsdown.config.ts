import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/react.ts"],
  format: "esm",
  platform: "browser",
  target: "es2022",
  dts: true,
  clean: true,
  sourcemap: true,
  fixedExtension: false,
  deps: { neverBundle: ["react", "react-dom", "react-dom/client"] },
});
