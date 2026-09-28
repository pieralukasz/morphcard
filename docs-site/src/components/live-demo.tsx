"use client";
import { useEffect, useRef, useState } from "react";
import "../../../examples/shared/demo.css";

type Demo = {
  morph: {
    state: string;
    setOptions(o: Record<string, unknown>): void;
    close(): Promise<boolean>;
  };
  destroy(): void;
};

/**
 * The deliveries demo from examples/, running on the library source. It sits
 * in a phone-sized frame; the list scrolls inside it.
 */
export function LiveDemo({ controls = true }: { controls?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const demo = useRef<Demo | null>(null);
  const [slow, setSlow] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [state, setState] = useState("closed");

  useEffect(() => {
    let alive = true;
    let mounted: Demo | null = null;
    // Loaded on the client only: it touches the DOM as soon as it runs.
    Promise.all([
      import("../../../src/index"),
      import("../../../examples/shared/demo-app.js"),
    ]).then(([{ createMorph }, { mountDemo }]) => {
      const el = host.current;
      if (!alive || !el) return;
      mounted = mountDemo(createMorph, el, {
        layout: "frame",
        wide: false,
        onStateChange: (next: string) => setState(next),
      }) as Demo;
      demo.current = mounted;
      el.dataset.ready = "1";
    });
    return () => {
      alive = false;
      mounted?.destroy();
      demo.current = null;
      if (host.current) host.current.innerHTML = "";
    };
  }, []);

  useEffect(() => {
    demo.current?.morph.setOptions({
      timeScale: slow ? 4 : 1,
      reducedMotion: reduce ? true : "system",
    });
  }, [slow, reduce]);

  return (
    <div className="not-prose flex flex-col items-center gap-3">
      <div className="mc-device" ref={host} data-live-demo />
      {controls ? (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <Toggle on={slow} onClick={() => setSlow((v) => !v)}>
            4× slower
          </Toggle>
          <Toggle on={reduce} onClick={() => setReduce((v) => !v)}>
            Reduced motion
          </Toggle>
          <span className="text-fd-muted-foreground tabular-nums" aria-live="polite">
            state: <code>{state}</code>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-medium transition-colors ${
        on
          ? "border-fd-primary bg-fd-primary text-fd-primary-foreground"
          : "bg-fd-card text-fd-muted-foreground hover:text-fd-foreground"
      }`}
    >
      {children}
    </button>
  );
}
