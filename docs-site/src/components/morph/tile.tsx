"use client";
/**
 * A tile that grows into a sheet through the page's MorphStage. The icon,
 * kicker and title fly into the sheet header; the summary and the "Open"
 * line fade with the card, and the sheet's own blocks come in staggered.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { useStage } from "./stage";
import { useLeave } from "./use-leave";

export interface TileProps {
  kicker: string;
  title: string;
  summary: ReactNode;
  icon?: ReactNode;
  /** Sheet content under the header. An array staggers block by block. */
  detail: ReactNode | ReactNode[];
  href?: string;
  hrefLabel?: string;
  /** Text on the tile's call to action. */
  more?: string;
  className?: string;
}

export function MorphTile({ kicker, title, summary, icon, detail, href, hrefLabel, more = "Open", className }: TileProps) {
  const stage = useStage();
  return (
    <article className={`mcs-tile ${className ?? ""}`}>
      <button
        type="button"
        className="mcs-hit"
        aria-label={`${title}: ${more.toLowerCase()}`}
        onClick={(e) =>
          stage.open(e.currentTarget.parentElement, {
            label: title,
            kind: "tile",
            render: () => <TileSheet {...{ kicker, title, icon, detail, href, hrefLabel }} />,
          })
        }
      />
      <div className="mcs-tile-head">
        {icon ? (
          <span className="mcs-icon" data-morph="icon" data-morph-mode="box">
            {icon}
          </span>
        ) : null}
        <span className="mcs-kicker" data-morph="kicker">
          {kicker}
        </span>
      </div>
      <h3 className="mcs-tile-title" data-morph="title">
        {title}
      </h3>
      <div className="mcs-tile-text">{summary}</div>
      <span className="mcs-more" aria-hidden="true">
        {more}
        <Arrow />
      </span>
    </article>
  );
}

export function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** A link inside a sheet: fades the sheet out while the next page loads. */
export function SheetLink({ href, children }: { href: string; children: ReactNode }) {
  const leave = useLeave();
  return (
    <Link className="mcs-link" href={href} onClick={(e) => leave(e, href)}>
      {children}
      <Arrow size={16} />
    </Link>
  );
}

function TileSheet({
  kicker,
  title,
  icon,
  detail,
  href,
  hrefLabel,
}: Pick<TileProps, "kicker" | "title" | "icon" | "detail" | "href" | "hrefLabel">) {
  return (
    <>
      <header className="mcs-head">
        <div className="mcs-tile-head">
          {icon ? (
            <span className="mcs-icon is-large" data-morph="icon" data-morph-mode="box">
              {icon}
            </span>
          ) : null}
          <span className="mcs-kicker is-large" data-morph="kicker">
            {kicker}
          </span>
        </div>
        <h2 className="mcs-title" data-morph="title">
          {title}
        </h2>
      </header>
      {Array.isArray(detail) ? (
        <div className="mcs-prose">
          {detail.map((block, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static blocks, never reordered
            <div key={i} data-morph-stagger>
              {block}
            </div>
          ))}
        </div>
      ) : (
        <div className="mcs-prose" data-morph-stagger>
          {detail}
        </div>
      )}
      {href ? (
        <div className="mcs-foot" data-morph-stagger>
          <SheetLink href={href}>{hrefLabel ?? "Read the full page"}</SheetLink>
        </div>
      ) : null}
    </>
  );
}
