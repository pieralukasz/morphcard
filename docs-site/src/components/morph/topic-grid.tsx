"use client";
/**
 * The docs overview grid: each topic card grows into a preview sheet with
 * the key points and a link to the full page.
 */
import { MorphTile } from "./tile";
import { topics } from "./topics";

export function TopicGrid({ only }: { only?: string[] }) {
  const list = only ? topics.filter((t) => only.includes(t.slug)) : topics;
  return (
    <div className="not-prose mcs-grid is-topics">
      {list.map((t) => (
        <MorphTile
          key={t.slug}
          kicker={t.kicker}
          title={t.title}
          icon={t.icon}
          summary={<p>{t.summary}</p>}
          more="Preview"
          href={`/docs/${t.slug}`}
          hrefLabel={`Read ${t.title}`}
          detail={
            <>
              <p className="mcs-lead">{t.lead}</p>
              <ul>
                {t.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </>
          }
        />
      ))}
    </div>
  );
}
