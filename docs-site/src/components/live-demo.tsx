"use client";
import { type ReactNode, useEffect, useRef, useState } from "react";
import "../../../examples/shared/demo.css";

export interface DemoMorph {
  state: string;
  setOptions(o: Record<string, unknown>): void;
  close(): Promise<boolean>;
}

export interface DemoHandle {
  morph: DemoMorph;
  open(id: string): Promise<boolean>;
  close(): Promise<boolean>;
  destroy(): void;
}

/**
 * The deliveries demo from examples/, running on the library source, in a
 * phone-sized frame. The list scrolls inside the frame.
 *
 * `options` go to setOptions whenever they change (the playground binds its
 * controls here). `theme` "site" follows the docs theme.
 */
export function LiveDemo({
  controls = true,
  hint,
  options,
  theme = "site",
  onReady,
  onState,
  className,
}: {
  controls?: boolean;
  hint?: ReactNode;
  options?: Record<string, unknown>;
  theme?: "site" | "light" | "dark";
  onReady?: (demo: DemoHandle) => void;
  onState?: (state: string) => void;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const demo = useRef<DemoHandle | null>(null);
  const [slow, setSlow] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [state, setState] = useState("closed");
  const [touched, setTouched] = useState(false);
  const callbacks = useRef({ onReady, onState });
  callbacks.current = { onReady, onState };

  const merged = options ?? { timeScale: slow ? 4 : 1, reducedMotion: reduce ? true : "system" };
  const latest = useRef(merged);
  latest.current = merged;
  const key = JSON.stringify(merged);

  useEffect(() => {
    let alive = true;
    let mounted: DemoHandle | null = null;
    // Loaded on the client only: it touches the DOM as soon as it runs.
    Promise.all([import("../../../src/index"), import("../../../examples/shared/demo-app.js")]).then(
      ([{ createMorph }, { mountDemo }]) => {
        const el = host.current;
        if (!alive || !el) return;
        mounted = mountDemo(createMorph, el, {
          layout: "frame",
          wide: false,
          onStateChange: (next: string) => {
            setState(next);
            if (next === "opening") setTouched(true);
            callbacks.current.onState?.(next);
          },
        }) as DemoHandle;
        mounted.morph.setOptions(latest.current);
        demo.current = mounted;
        el.dataset.ready = "1";
        callbacks.current.onReady?.(mounted);
      },
    );
    return () => {
      alive = false;
      mounted?.destroy();
      demo.current = null;
      if (host.current) host.current.innerHTML = "";
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: key is the serialised options
  useEffect(() => {
    demo.current?.morph.setOptions(latest.current);
  }, [key]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.classList.toggle("is-dark", theme === "dark");
    el.classList.toggle("is-light", theme === "light");
  }, [theme]);

  return (
    <div className={`not-prose flex w-full flex-col items-center gap-3 ${className ?? ""}`}>
      <div className="mc-device-wrap">
        <div className="mc-device" ref={host} data-live-demo />
        {hint ? (
          <div className="mc-hint" data-hidden={touched ? "" : undefined} aria-hidden="true">
            {hint}
          </div>
        ) : null}
      </div>
      {controls && !options ? (
        <div className="flex w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-2 text-sm">
          <Toggle on={slow} onClick={() => setSlow((v) => !v)}>
            4× slower
          </Toggle>
          <Toggle on={reduce} onClick={() => setReduce((v) => !v)}>
            Reduced motion
          </Toggle>
          {/*
            The slot is as wide as its longest value ("closing"), so the row
            never reflows while the demo animates.
          */}
          <span className="inline-grid justify-items-start text-fd-muted-foreground tabular-nums">
            <span aria-hidden="true" className="invisible col-start-1 row-start-1">
              state: <code>closing</code>
            </span>
            <span className="col-start-1 row-start-1" aria-live="polite">
              state: <code>{state}</code>
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="mc-toggle">
      {children}
    </button>
  );
}
