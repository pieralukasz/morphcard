import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { MorphStage } from "@/components/morph/stage";
import { baseOptions } from "@/lib/layout.shared";
import { authorUrl } from "@/lib/shared";
import { source } from "@/lib/source";

// The article column (#nd-page) recedes behind the sheet. The whole layout
// cannot: the sidebar has a position: fixed button, and the library does not
// scale a background with fixed children (a transform would drag them).
export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <MorphStage className="mcs-page" background="#nd-page">
      <DocsLayout
        tree={source.getPageTree()}
        {...baseOptions()}
        sidebar={{
          footer: (
            <p className="px-2 pt-2 text-xs text-fd-muted-foreground">
              Made by{" "}
              <a className="font-medium underline underline-offset-2" href={authorUrl}>
                Lucas Piera
              </a>
            </p>
          ),
        }}
      >
        {children}
      </DocsLayout>
    </MorphStage>
  );
}
