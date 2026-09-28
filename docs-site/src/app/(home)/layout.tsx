import { HomeLayout } from "fumadocs-ui/layouts/home";
import { MorphStage } from "@/components/morph/stage";
import { baseOptions } from "@/lib/layout.shared";

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <MorphStage className="mcs-page">
      <HomeLayout {...baseOptions()}>{children}</HomeLayout>
    </MorphStage>
  );
}
