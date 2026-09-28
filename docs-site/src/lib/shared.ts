import { createGetUrl } from "fumadocs-core/source";

export const appName = "react-morphcard";
export const tagline = "A card that grows into a detail screen and shrinks back.";
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefixes files from `public/` so they resolve when the site has a base path. */
export function asset(path: string) {
  return `${basePath}${path}`;
}
export const docsRoute = "/docs";
export const docsImageRoute = "/og/docs";
export const docsContentRoute = "/llms.mdx/docs";

export const gitConfig = {
  user: "pieralukasz",
  repo: "react-morphcard",
  branch: "main",
};

export const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
export const authorUrl = "https://lucaspiera.com";
/** The docs site keeps its address; the package and repo are react-morphcard. */
export const siteUrl = "https://morphcard.lucaspiera.com";
export const install = "pnpm add react-morphcard";

const getContentUrl = createGetUrl(docsContentRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, "content.md"];

  return { segments, url: getContentUrl(segments, page.locale) };
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, "image.png"];

  return { segments, url: getImageUrl(segments, page.locale) };
}
