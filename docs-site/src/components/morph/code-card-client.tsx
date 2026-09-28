"use client";
/**
 * A compact code card: file name, language and the first lines. Tapping it
 * grows the card into the full example. The code block is a shared element:
 * the card's lines and the full listing fly together and crossfade.
 */
import type { ReactNode } from "react";
import { useStage } from "./stage";
import { Arrow } from "./tile";

export interface CodeCardProps {
  file: string;
  lang: string;
  /** One line under the file name. */
  note?: string;
  /** Highlighted first lines. */
  preview: ReactNode;
  /** Highlighted full listing. */
  full: ReactNode;
  /** Plain source, for the copy button. */
  source: string;
  lines: number;
  children?: ReactNode;
}

export function CodeCardClient({ file, lang, note, preview, full, source, lines, children }: CodeCardProps) {
  const stage = useStage();
  return (
    <article className="mcs-tile mcs-code-card">
      <button
        type="button"
        className="mcs-hit"
        aria-label={`Open the full example ${file}`}
        onClick={(e) =>
          stage.open(e.currentTarget.parentElement, {
            label: file,
            kind: "code",
            render: () => <CodeSheet {...{ file, lang, note, full, source, lines, children }} />,
          })
        }
      />
      <div className="mcs-code-head">
        <span className="mcs-file" data-morph="file">
          {file}
        </span>
        <span className="mcs-badge" data-morph="lang">
          {lang}
        </span>
      </div>
      {note ? <p className="mcs-code-note">{note}</p> : null}
      <div className="mcs-code is-preview" data-morph="code" aria-hidden="true">
        {preview}
      </div>
      <span className="mcs-more" aria-hidden="true">
        Show all {lines} lines
        <Arrow />
      </span>
    </article>
  );
}

function CodeSheet({ file, lang, note, full, source, children }: Omit<CodeCardProps, "preview">) {
  return (
    <>
      <header className="mcs-code-head is-sheet">
        <span className="mcs-file is-large" data-morph="file">
          {file}
        </span>
        <span className="mcs-badge" data-morph="lang">
          {lang}
        </span>
        <CopyButton source={source} />
      </header>
      {note ? (
        <p className="mcs-code-note is-sheet" data-morph-stagger>
          {note}
        </p>
      ) : null}
      <div className="mcs-code is-full" data-morph="code">
        {full}
      </div>
      {children ? (
        <div className="mcs-prose" data-morph-stagger>
          {children}
        </div>
      ) : null}
    </>
  );
}

function CopyButton({ source }: { source: string }) {
  return (
    <button
      type="button"
      className="mcs-copy"
      onClick={(e) => {
        const button = e.currentTarget;
        void navigator.clipboard?.writeText(source).then(() => {
          button.dataset.copied = "";
          setTimeout(() => delete button.dataset.copied, 1400);
        });
      }}
    >
      <span className="is-idle">Copy</span>
      <span className="is-done" aria-live="polite">
        Copied
      </span>
    </button>
  );
}
