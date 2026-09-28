import { asset } from "@/lib/shared";

/**
 * A recording of the demo, made by scripts/make-videos.sh. Plays muted and
 * loops. Light and dark versions swap with the site theme. Files in
 * public/videos: <name>-<theme>.mp4, <name>-<theme>-4x.mp4 and the poster
 * <name>-<theme>.png (without -<theme> when `themed` is false).
 */
export function Video({
  name,
  caption,
  slow = true,
  themed = true,
  width = 390,
  height = 800,
  className,
}: {
  name: string;
  caption?: string;
  /** The 4x slower version. */
  slow?: boolean;
  themed?: boolean;
  width?: number;
  height?: number;
  className?: string;
}) {
  const variants = themed ? (["light", "dark"] as const) : ([null] as const);
  return (
    <figure
      className={`not-prose my-6 flex flex-col items-center ${className ?? ""}`}
    >
      {variants.map((theme) => {
        const file = theme ? `${name}-${theme}` : name;
        return (
          <video
            key={file}
            className="mc-video h-auto max-h-[640px] w-auto max-w-full rounded-2xl border bg-fd-card"
            data-theme={theme ?? undefined}
            width={width}
            height={height}
            src={asset(`/videos/${file}${slow ? "-4x" : ""}.mp4`)}
            poster={asset(`/videos/${file}.png`)}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            aria-label={caption}
          />
        );
      })}
      {caption ? (
        <figcaption className="mt-2 max-w-sm text-center text-sm text-fd-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
