import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, repoUrl } from "./shared";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="24"
      height="24"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="3"
        y="15"
        width="16"
        height="11"
        rx="3.5"
        fill="currentColor"
        opacity="0.35"
      />
      <rect
        x="9"
        y="5"
        width="20"
        height="22"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2 font-semibold">
          <Logo className="text-fd-primary" />
          {appName}
        </span>
      ),
    },
    githubUrl: repoUrl,
    links: [
      { text: "Docs", url: "/docs" },
      { text: "API", url: "/docs/api" },
    ],
  };
}
