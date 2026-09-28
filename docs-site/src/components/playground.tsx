"use client";
/**
 * The playground. Its controls change the options of the useMorph hooks on
 * this page: the page's own sheet (the tiles below) and the phone demo. What
 * you see after changing a value is exactly what that option does.
 */
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { LiveDemo, StateLabel, Toggle } from "@/components/live-demo";
import { MORPH_DEFAULTS, type MorphTuning } from "@/components/morph/defaults";
import { useStage } from "@/components/morph/stage";
import { MorphTile } from "@/components/morph/tile";

const EASINGS = {
  surface: [
    ["cubic-bezier(0.32, 0.72, 0, 1)", "Default: fast start, long soft landing"],
    ["cubic-bezier(0.2, 0, 0, 1)", "Emphasized: stronger landing"],
    ["cubic-bezier(0.16, 1, 0.3, 1)", "Expo out: almost all motion up front"],
    ["cubic-bezier(0.77, 0, 0.175, 1)", "Ease in-out: slow start and end"],
    ["linear", "Linear, for comparison"],
  ],
  content: [
    ["cubic-bezier(0.23, 1, 0.32, 1)", "Default: quick arrival, settle"],
    ["cubic-bezier(0.32, 0.72, 0, 1)", "Same as the surface"],
    ["ease-out", "CSS ease-out"],
    ["linear", "Linear, for comparison"],
  ],
} as const;

const START = {
  open: MORPH_DEFAULTS.duration.open,
  close: MORPH_DEFAULTS.duration.close,
  stagger: MORPH_DEFAULTS.stagger,
  scale: true,
  surface: MORPH_DEFAULTS.easing.surface as string,
  content: MORPH_DEFAULTS.easing.content as string,
};

const i = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export function Playground() {
  const stage = useStage();
  const [v, setV] = useState(START);
  const [slow, setSlow] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [demoState, setDemoState] = useState("closed");
  const set = <K extends keyof typeof START>(key: K, value: (typeof START)[K]) => setV((old) => ({ ...old, [key]: value }));

  const options = useMemo<MorphTuning>(
    () => ({
      duration: { open: v.open, close: v.close },
      easing: { surface: v.surface, content: v.content },
      stagger: v.stagger,
      backgroundScale: v.scale ? MORPH_DEFAULTS.backgroundScale : false,
      timeScale: slow ? 4 : 1,
      reducedMotion: reduce ? true : "system",
    }),
    [v, slow, reduce],
  );

  // The page's own sheet follows the controls; leaving the page restores the defaults.
  const { configure } = stage;
  useEffect(() => configure(options), [configure, options]);
  useEffect(() => () => configure(null), [configure]);

  const code = useMemo(() => {
    const lines: string[] = [];
    if (v.open !== START.open || v.close !== START.close) lines.push(`  duration: { open: ${v.open}, close: ${v.close} },`);
    if (v.surface !== START.surface || v.content !== START.content) {
      lines.push(`  easing: {\n    surface: "${v.surface}",\n    content: "${v.content}",\n  },`);
    }
    if (v.stagger !== START.stagger) lines.push(`  stagger: ${v.stagger},`);
    if (!v.scale) lines.push("  backgroundScale: false,");
    if (reduce) lines.push("  reducedMotion: true,");
    if (slow) lines.push("  timeScale: 4, // for review only");
    return lines.length ? `const morph = useMorph({\n${lines.join("\n")}\n});` : "const morph = useMorph(); // the defaults";
  }, [v, slow, reduce]);

  return (
    <div className="not-prose mcp">
      <div className="mcp-panel">
        <fieldset className="mcp-group">
          <legend>Duration</legend>
          <Range label="Open" unit="ms" min={150} max={1200} step={10} value={v.open} onChange={(n) => set("open", n)} />
          <Range label="Close" unit="ms" min={120} max={1000} step={10} value={v.close} onChange={(n) => set("close", n)} />
          <Range label="Stagger" unit="ms" min={0} max={150} step={5} value={v.stagger} onChange={(n) => set("stagger", n)} />
        </fieldset>
        <fieldset className="mcp-group">
          <legend>Easing</legend>
          <Select label="Surface" value={v.surface} options={EASINGS.surface} onChange={(s) => set("surface", s)} />
          <Select label="Content" value={v.content} options={EASINGS.content} onChange={(s) => set("content", s)} />
        </fieldset>
        <fieldset className="mcp-group is-row">
          <legend>Motion</legend>
          <Toggle on={v.scale} onClick={() => set("scale", !v.scale)}>
            Background scale
          </Toggle>
          <Toggle on={slow} onClick={() => setSlow((x) => !x)}>
            4× slower
          </Toggle>
          <Toggle on={reduce} onClick={() => setReduce((x) => !x)}>
            Reduced motion
          </Toggle>
          <button
            type="button"
            className="mc-toggle mcp-reset"
            onClick={() => {
              setV(START);
              setSlow(false);
              setReduce(false);
            }}
          >
            Reset
          </button>
        </fieldset>
        <pre className="mcp-code">
          <code>{code}</code>
        </pre>
      </div>

      <div className="mcp-stage">
        <h2 className="mcp-heading">Tiles on this page</h2>
        <p className="mcp-help">These open into the page's own panel, with the options above.</p>
        <div className="mcs-grid is-features">
          <MorphTile
            kicker="Duration"
            title="How long each way"
            icon={i("M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z")}
            summary={<p>Open and close are separate. Closing is usually shorter.</p>}
            more="Try it"
            detail={explain(options, "duration")}
          />
          <MorphTile
            kicker="Easing"
            title="How the speed changes"
            icon={i("M3 20c6 0 8-16 18-16")}
            summary={<p>The surface curve drives the clip, the flights and the background.</p>}
            more="Try it"
            detail={explain(options, "easing")}
          />
          <MorphTile
            kicker="Stagger"
            title="Blocks one after another"
            icon={i("M4 6h10M4 12h13M4 18h16")}
            summary={<p>Each block below the header starts a little after the one above it.</p>}
            more="Try it"
            detail={explain(options, "stagger")}
          />
        </div>
      </div>

      <div className="mcp-demo">
        <div>
          <h2 className="mcp-heading">The phone demo</h2>
          <p className="mcp-help">Same options, a second hook inside the frame.</p>
        </div>
        <LiveDemo options={options} onState={setDemoState} controls={false} />
        <StateLabel state={demoState} />
      </div>
    </div>
  );
}

function explain(options: MorphTuning, topic: "duration" | "easing" | "stagger"): ReactNode[] {
  const blocks: [string, ReactNode][] = [
    ["Now", <code key="c">{topic === "duration" ? `open ${options.duration?.open} ms, close ${options.duration?.close} ms` : topic === "easing" ? options.easing?.surface : `${options.stagger} ms`}</code>],
    [
      "What moves",
      topic === "duration"
        ? "Every part of the transition is a fraction of these two numbers, so changing them keeps the proportions."
        : topic === "easing"
          ? "The surface curve shapes the clip, the flying title and the page behind. The content curve shapes the blocks below."
          : "Each block of this panel, like this one, starts that many milliseconds after the previous one.",
    ],
    ["Try", "Change the value on the left, then open this tile again. Slow motion makes the difference easy to see."],
    ["Default", topic === "duration" ? "400 ms to open, 300 ms to close." : topic === "easing" ? "cubic-bezier(0.32, 0.72, 0, 1) for the surface." : "45 ms."],
  ];
  return blocks.map(([label, text]) => (
    <p key={label}>
      <b>{label}.</b> {text}
    </p>
  ));
}

function Range({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="mcp-range">
      <span className="mcp-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.currentTarget.value))} />
      <output className="mcp-value">
        {value}
        {unit ? <small> {unit}</small> : null}
      </output>
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (s: string) => void;
}) {
  return (
    <label className="mcp-select">
      <span className="mcp-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.currentTarget.value)}>
        {options.map(([val, name]) => (
          <option key={val} value={val}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
