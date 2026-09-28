"use client";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useStage } from "./stage";

/**
 * Click handler for links inside the sheet. A plain click starts a fade-out
 * of the sheet (to: null, so nothing flies back to a card on a page that is
 * about to change) and navigates at once. Modified clicks keep the default.
 */
export function useLeave() {
  const stage = useStage();
  const router = useRouter();
  return (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    void stage.close({ to: null });
    router.push(href);
  };
}
