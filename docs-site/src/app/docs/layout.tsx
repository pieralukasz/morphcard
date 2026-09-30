import { GlassLayout } from "fumadocs-ui/layouts/glass";
import { MorphStage } from "@/components/morph/stage";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

// The article column recedes behind the sheet. The whole layout cannot: the
// sidebar and header are sticky panels, and the library does not scale a
// background with fixed or sticky children (a transform would drag them).
export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <MorphStage className="mcs-page" background="#fd-glass-layout > [data-fd-full]">
      <GlassLayout tree={source.getPageTree()} {...baseOptions()}>
        {children}
      </GlassLayout>
    </MorphStage>
  );
}
