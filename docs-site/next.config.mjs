import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

// The live demo imports the library source and the demo from the repository
// root (../src, ../examples), so the build root is one level up.
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
  },
};

export default withMDX(config);
