"use client";
/**
 * A recording as a tile. Tapping it grows the poster into a large player
 * (the poster and the player are one shared element, so the picture itself
 * flies); Back shrinks the player into the tile.
 *
 * The player shows the poster while it flies and starts playing once open.
 * On close it is reset with load(), which puts the poster back, so the
 * picture that lands on the tile is the tile's own picture.
 */
import { useEffect, useRef } from "react";
import { asset } from "@/lib/shared";
import { useStage } from "./stage";

export interface VideoTileProps {
  /** File prefix in public/videos (see scripts/make-videos.sh). */
  name: string;
  title: string;
  caption: string;
  /** Plays the 4x slower file in the player. */
  slow?: boolean;
  /** Separate light and dark files. */
  themed?: boolean;
  width?: number;
  height?: number;
  badge?: string;
}

function files(name: string, themed: boolean) {
  return themed ? [`${name}-light`, `${name}-dark`] : [name];
}

export function VideoTile({ name, title, caption, slow = true, themed = true, width = 390, height = 800, badge }: VideoTileProps) {
  const stage = useStage();
  const variants = files(name, themed);
  return (
    <article className="mcs-tile mcs-video-tile" data-orientation={width > height ? "wide" : "tall"}>
      <button
        type="button"
        className="mcs-hit"
        aria-label={`Play: ${title}`}
        onClick={(e) =>
          stage.open(e.currentTarget.parentElement, {
            label: title,
            wide: width > height,
            render: () => <Player {...{ name, title, caption, slow, themed, width, height, badge }} />,
          })
        }
      />
      <div className="mcs-media" data-morph="media" data-morph-mode="box" style={{ aspectRatio: `${width} / ${height}` }}>
        {variants.map((file) => (
          // biome-ignore lint/performance/noImgElement: static export, plain posters
          <img
            key={file}
            src={asset(`/videos/${file}.png`)}
            alt=""
            width={width}
            height={height}
            data-theme={themed ? (file.endsWith("-dark") ? "dark" : "light") : undefined}
            loading="lazy"
          />
        ))}
        <span className="mcs-play" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>
      </div>
      <div className="mcs-video-meta">
        <h3 className="mcs-tile-title" data-morph="title">
          {title}
        </h3>
        {badge ? (
          <span className="mcs-badge" data-morph="badge">
            {badge}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function Player({ name, title, caption, slow, themed, width, height, badge }: Required<Omit<VideoTileProps, "badge">> & { badge?: string }) {
  const stage = useStage();
  const box = useRef<HTMLDivElement>(null);
  const variants = files(name, themed);

  useEffect(() => {
    const videos = Array.from(box.current?.querySelectorAll("video") ?? []);
    const visible = videos.find((v) => v.checkVisibility?.() ?? v.offsetParent !== null);
    if (stage.state === "open") {
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (visible && !still) void visible.play().catch(() => {});
    } else if (stage.state === "closing") {
      for (const v of videos) {
        v.pause();
        v.load();
      }
    }
  }, [stage.state]);

  return (
    <>
      <div
        className="mcs-media is-player"
        data-morph="media"
        data-morph-mode="box"
        ref={box}
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {variants.map((file) => (
          <video
            key={file}
            src={asset(`/videos/${file}${slow ? "-4x" : ""}.mp4`)}
            poster={asset(`/videos/${file}.png`)}
            width={width}
            height={height}
            data-theme={themed ? (file.endsWith("-dark") ? "dark" : "light") : undefined}
            muted
            loop
            playsInline
            controls
            preload="metadata"
            aria-label={caption}
          />
        ))}
      </div>
      <div className="mcs-video-meta is-sheet">
        <h2 className="mcs-title is-small" data-morph="title">
          {title}
        </h2>
        {badge ? (
          <span className="mcs-badge" data-morph="badge">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mcs-caption" data-morph-stagger>
        {caption}
      </p>
    </>
  );
}
