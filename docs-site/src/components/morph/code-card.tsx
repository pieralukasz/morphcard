/**
 * Server half of the code card: reads a snippet from docs-site/snippets (the
 * snippets are real files, type-checked against the library source) and
 * highlights it with Shiki at build time.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlight } from "fumadocs-core/highlight";
import type { ReactNode } from "react";
import { CodeCardClient } from "./code-card-client";

const LANG_LABEL: Record<string, string> = {
  tsx: "React",
  jsx: "React",
  ts: "TypeScript",
  js: "JavaScript",
  css: "CSS",
  html: "HTML",
};

export function readSnippet(file: string) {
  return readFileSync(join(process.cwd(), "snippets", file), "utf8").trimEnd();
}

export async function CodeCard({
  file,
  name,
  note,
  previewLines = 7,
  children,
}: {
  /** Path under docs-site/snippets. */
  file: string;
  /** Shown file name. Default: the base name of `file`. */
  name?: string;
  note?: string;
  previewLines?: number;
  children?: ReactNode;
}) {
  const source = readSnippet(file);
  const ext = file.split(".").pop() ?? "txt";
  const lang = ext === "js" ? "js" : ext;
  const lines = source.split("\n");
  const [preview, full] = await Promise.all([
    highlight(lines.slice(0, previewLines).join("\n"), { lang }),
    highlight(source, { lang }),
  ]);
  return (
    <CodeCardClient
      file={name ?? file.split("/").pop() ?? file}
      lang={LANG_LABEL[ext] ?? ext}
      note={note}
      preview={preview}
      full={full}
      source={source}
      lines={lines.length}
    >
      {children}
    </CodeCardClient>
  );
}
