import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

// The site builds the library from its source (../src) and reuses the demo
// data and styles in ../examples, so the build root is one level up.
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Empty on Vercel. Set it to serve the static export from a sub-path.
const basePath = process.env.DOCS_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  reactStrictMode: true,
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
    // The site uses the library the way an app would, by package name, but
    // builds it from the source in this repository (tsconfig paths match).
    resolveAlias: {
      "react-morphcard": "../src/index.ts",
    },
  },
};

export default withMDX(config);
