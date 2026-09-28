import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { LiveDemo } from "@/components/live-demo";
import { CodeCard } from "@/components/morph/code-card";
import { FeatureTiles } from "@/components/morph/features";
import { TopicGrid } from "@/components/morph/topic-grid";
import { VideoGrid, VideoTile } from "@/components/morph/video-tile";
import { Playground } from "@/components/playground";
import { Timeline } from "@/components/timeline";
import { Video } from "@/components/video";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Accordion,
    Accordions,
    CodeCard,
    FeatureTiles,
    File,
    Files,
    Folder,
    LiveDemo,
    Playground,
    Step,
    Steps,
    Tab,
    Tabs,
    Timeline,
    TopicGrid,
    Video,
    VideoGrid,
    VideoTile,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
