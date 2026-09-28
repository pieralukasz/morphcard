"use client";
/**
 * A tile that grows into a sheet through the page's MorphStage. The tile's
 * kicker, icon and title fly into the sheet header; the rest of the tile
 * fades and the sheet's own content staggers in.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { useStage } from "./stage";

export interface TileProps {
  kicker: string;
  title: string;
  summary: ReactNode;
  icon?: ReactNode;
  /** Sheet content under the header. Blocks are staggered. */
  detail: ReactNode;
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
            render: () => <TileSheet {...{ kicker, title, icon, detail, href, hrefLabel }} />,
          })
        }
      />
      <div className="mcs-tile-head">
        {icon ? (
          <span className="mcs-icon" data-morph="icon">
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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </article>
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
            <span className="mcs-icon is-large" data-morph="icon">
              {icon}
            </span>
          ) : null}
          <span className="mcs-kicker" data-morph="kicker">
            {kicker}
          </span>
        </div>
        <h2 className="mcs-title" data-morph="title">
          {title}
        </h2>
      </header>
      <div className="mcs-prose" data-morph-stagger>
        {detail}
      </div>
      {href ? (
        <div data-morph-stagger>
          <Link className="mcs-link" href={href}>
            {hrefLabel ?? "Read the full page"}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      ) : null}
    </>
  );
}
