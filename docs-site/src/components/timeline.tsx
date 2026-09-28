"use client";
/**
 * A scrubbable timeline for the Anatomy page. It starts a real transition on
 * the live demo, pauses every animation the library created, and seeks them
 * all to the slider's time. The bars are computed from the library's own
 * `defaults` and `choreography`, so the numbers cannot drift from the code.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { type DemoHandle, LiveDemo, Toggle } from "@/components/live-demo";
import { choreography, defaults } from "../../../src/index";

type Phase = "open" | "close";

interface Bar {
  label: string;
  from: number;
  to: number;
  kind: "surface" | "fly" | "fade" | "content";
  note?: string;
}

function bars(phase: Phase, blocks: number): Bar[] {
  const D = defaults.duration.open;
  const C = defaults.duration.close;
  const o = choreography.open;
  const c = choreography.close;
  if (phase === "open") {
    const first = o.contentDelay * D;
    return [
      { label: "Surface clip", from: 0, to: D, kind: "surface", note: "clip-path from the card to full screen" },
      { label: "Shared flights", from: 0, to: D, kind: "fly", note: "route, company, reference, badge" },
      { label: "Card copy out", from: 0, to: o.copyOut * D, kind: "fade", note: "the card's version of a crossfading text" },
      { label: "Header copy in", from: 0, to: o.targetIn * D, kind: "fade", note: "the sheet's version, flying with it" },
      { label: "Card meta out", from: 0, to: o.restOut * D, kind: "fade", note: "what only the card has" },
      {
        label: "Content",
        from: first,
        to: first + Math.max(0, blocks - 1) * defaults.stagger + o.content * D,
        kind: "content",
        note: `${blocks} blocks, ${defaults.stagger} ms apart, ${o.content * D} ms each`,
      },
      { label: "Action bar", from: o.dockDelay * D, to: (o.dockDelay + o.dock) * D, kind: "content", note: "slides up" },
      { label: "List and scrim", from: 0, to: D, kind: "surface", note: `list scales to ${defaults.backgroundScale}` },
    ];
  }
  return [
    { label: "Surface clip", from: 0, to: C, kind: "surface", note: "full screen back to the card" },
    { label: "Shared flights", from: 0, to: C, kind: "fly", note: "back to the card" },
    { label: "Header copy out", from: 0, to: c.targetOut * C, kind: "fade", note: "the big heading gives way first" },
    { label: "Card copy in", from: 0, to: c.copyIn * C, kind: "fade", note: "so the card's own text lands" },
    { label: "Content out", from: 0, to: c.contentOut * C, kind: "content", note: "follows the lowest flight down" },
    { label: "Action bar", from: 0, to: c.dock * C, kind: "content", note: "slides down" },
    { label: "Card meta in", from: c.restDelay * C, to: (c.restDelay + c.rest) * C, kind: "fade", note: "ends with the surface" },
    { label: "List and scrim", from: 0, to: C, kind: "surface", note: "end together with the surface" },
  ];
}

const CARD = "2042";

export function Timeline() {
  const wrap = useRef<HTMLDivElement>(null);
  const demo = useRef<DemoHandle | null>(null);
  const anims = useRef<Animation[]>([]);
  const armedFor = useRef<Phase | null>(null);
  const frame = useRef(0);
  const [phase, setPhase] = useState<Phase>("open");
  const [t, setT] = useState(0);
  const [total, setTotal] = useState<number>(defaults.duration.open);
  const [blocks, setBlocks] = useState(4);
  const [slow, setSlow] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [systemReduce, setSystemReduce] = useState(false);
  const [allowMotion, setAllowMotion] = useState(false);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    setSystemReduce(mq.matches);
    const on = () => setSystemReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const collect = useCallback(
    () =>
      document.getAnimations().filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return !(a instanceof CSSTransition) && target instanceof Node && Boolean(wrap.current?.contains(target));
      }),
    [],
  );

  const finishAll = useCallback(() => {
    for (const a of collect()) if (a.effect && Number(a.effect.getComputedTiming().endTime) > 0) a.finish();
  }, [collect]);

  /** Starts a paused run of `p` from its real starting state. */
  const arm = useCallback(
    async (p: Phase) => {
      const d = demo.current;
      if (!d) return false;
      cancelAnimationFrame(frame.current);
      setPlaying(false);
      const need = p === "open" ? "closed" : "open";
      if (d.morph.state !== need) {
        const reached = need === "open" ? d.open(CARD) : d.close();
        finishAll();
        await reached;
        finishAll();
        await (need === "open" ? d.open(CARD) : d.close());
      }
      if (p === "open") void d.open(CARD);
      else void d.close();
      const run = collect();
      for (const a of run) a.pause();
      anims.current = run;
      armedFor.current = p;
      const end = Math.max(0, ...run.map((a) => Number(a.effect?.getComputedTiming().endTime ?? 0)));
      setTotal(end || (p === "open" ? defaults.duration.open : defaults.duration.close));
      const sheet = wrap.current?.querySelector(".mc-sheet");
      if (sheet) setBlocks(sheet.querySelectorAll("[data-morph-stagger]").length || 1);
      return true;
    },
    [collect, finishAll],
  );

  const live = () =>
    armedFor.current === phase &&
    anims.current.length > 0 &&
    anims.current.every((a) => a.playState === "paused") &&
    demo.current?.morph.state === (phase === "open" ? "opening" : "closing");

  const seek = async (ms: number) => {
    if (!live() && !(await arm(phase))) return;
    for (const a of anims.current) a.currentTime = ms;
    setT(ms);
  };

  /** Lets the run end so the library settles into its final state. */
  const release = () => {
    for (const a of anims.current) a.play();
    anims.current = [];
    armedFor.current = null;
  };

  const play = async () => {
    if (playing) {
      cancelAnimationFrame(frame.current);
      setPlaying(false);
      return;
    }
    let start = t;
    if (!live() || t >= total) {
      if (!(await arm(phase))) return;
      start = 0;
    }
    setPlaying(true);
    const speed = slow ? 0.25 : 1;
    let last = performance.now();
    let now = start;
    const tick = (time: number) => {
      now = Math.min(total, now + (time - last) * speed);
      last = time;
      for (const a of anims.current) a.currentTime = now;
      setT(now);
      if (now >= total) {
        setPlaying(false);
        release();
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const switchPhase = async (p: Phase) => {
    cancelAnimationFrame(frame.current);
    setPlaying(false);
    setPhase(p);
    setT(0);
    await arm(p);
  };

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const reduced = systemReduce && !allowMotion;
  const list = bars(phase, blocks);
  const scale = Math.max(total, ...list.map((b) => b.to));
  const pct = (ms: number) => `${(ms / scale) * 100}%`;

  return (
    <div className="not-prose mct" ref={wrap}>
      <LiveDemo
        options={{ timeScale: 1, reducedMotion: allowMotion ? false : "system" }}
        onReady={(d) => {
          demo.current = d;
        }}
      />
      <div className="mct-panel">
        <div className="mct-top">
          <div className="mcp-seg" role="group" aria-label="Phase">
            {(["open", "close"] as const).map((p) => (
              <button key={p} type="button" aria-pressed={phase === p} onClick={() => void switchPhase(p)}>
                {p === "open" ? `Open · ${defaults.duration.open} ms` : `Close · ${defaults.duration.close} ms`}
              </button>
            ))}
          </div>
          <Toggle on={slow} onClick={() => setSlow((s) => !s)}>
            Play 4× slower
          </Toggle>
        </div>

        {reduced ? (
          <p className="mct-note">
            Your system asks for reduced motion, so the demo fades instead of moving and these bars do not apply.{" "}
            <button type="button" className="underline" onClick={() => setAllowMotion(true)}>
              Show the full motion here
            </button>
          </p>
        ) : null}

        <div className="mct-chart" style={{ ["--mct-t" as string]: pct(t) }}>
          <div className="mct-axis" aria-hidden="true">
            {Array.from({ length: Math.floor(scale / 100) + 1 }, (_, i) => (
              <span key={i} style={{ left: pct(i * 100) }}>
                {i * 100}
              </span>
            ))}
          </div>
          {list.map((b) => (
            <div className="mct-row" key={b.label}>
              <span className="mct-name">{b.label}</span>
              <span className="mct-track">
                <span
                  className="mct-bar"
                  data-kind={b.kind}
                  data-active={t >= b.from && t <= b.to ? "" : undefined}
                  style={{ left: pct(b.from), width: pct(b.to - b.from) }}
                  title={`${Math.round(b.from)} to ${Math.round(b.to)} ms${b.note ? `: ${b.note}` : ""}`}
                />
              </span>
              <span className="mct-ms">
                {Math.round(b.from)}–{Math.round(b.to)}
              </span>
            </div>
          ))}
          <span className="mct-head" aria-hidden="true" />
        </div>

        <div className="mct-controls">
          <button type="button" className="mct-play" onClick={() => void play()} aria-label={playing ? "Pause" : "Play"}>
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            )}
          </button>
          <label className="mct-scrub">
            <span className="sr-only">Time in the {phase} transition</span>
            <input
              type="range"
              min={0}
              max={Math.round(total)}
              step={1}
              value={Math.round(t)}
              onChange={(e) => {
                cancelAnimationFrame(frame.current);
                setPlaying(false);
                void seek(Number(e.currentTarget.value));
              }}
              onPointerUp={() => {
                if (t >= total) release();
              }}
            />
          </label>
          <output className="mct-time">
            {Math.round(t)} <small>/ {Math.round(total)} ms</small>
          </output>
        </div>
        <p className="mct-help">Drag to scrub. The demo on the left is paused at that moment of a real transition.</p>
      </div>
    </div>
  );
}
