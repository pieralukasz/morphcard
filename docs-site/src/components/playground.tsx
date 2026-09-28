"use client";
/**
 * The playground: the live demo with controls bound to the real options.
 * Every change goes through morph.setOptions on the running instance.
 */
import { useMemo, useState } from "react";
import { LiveDemo, Toggle } from "@/components/live-demo";

const EASINGS = {
  surface: [
    ["cubic-bezier(0.32, 0.72, 0, 1)", "Default: fast start, long soft landing"],
    ["cubic-bezier(0.2, 0, 0, 1)", "Emphasized: stronger landing"],
    ["cubic-bezier(0.16, 1, 0.3, 1)", "Expo out: almost all motion up front"],
    ["ease-out", "CSS ease-out"],
    ["linear", "Linear, for comparison"],
  ],
  content: [
    ["cubic-bezier(0.23, 1, 0.32, 1)", "Default: quick arrival, settle"],
    ["cubic-bezier(0.32, 0.72, 0, 1)", "Same as the surface"],
    ["ease-out", "CSS ease-out"],
    ["linear", "Linear, for comparison"],
  ],
} as const;

const DEFAULTS = {
  open: 400,
  close: 300,
  stagger: 45,
  backgroundScale: 0.96,
  surface: EASINGS.surface[0][0] as string,
  content: EASINGS.content[0][0] as string,
};

export function Playground() {
  const [v, setV] = useState(DEFAULTS);
  const [slow, setSlow] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [theme, setTheme] = useState<"site" | "light" | "dark">("site");
  const [state, setState] = useState("closed");
  const set = <K extends keyof typeof DEFAULTS>(key: K, value: (typeof DEFAULTS)[K]) => setV((old) => ({ ...old, [key]: value }));

  const options = useMemo(
    () => ({
      duration: { open: v.open, close: v.close },
      easing: { surface: v.surface, content: v.content },
      stagger: v.stagger,
      backgroundScale: v.backgroundScale === 1 ? false : v.backgroundScale,
      timeScale: slow ? 4 : 1,
      reducedMotion: reduce ? true : "system",
    }),
    [v, slow, reduce],
  );

  const code = useMemo(() => {
    const lines: string[] = [];
    if (v.open !== DEFAULTS.open || v.close !== DEFAULTS.close) lines.push(`  duration: { open: ${v.open}, close: ${v.close} },`);
    if (v.surface !== DEFAULTS.surface || v.content !== DEFAULTS.content) {
      lines.push(`  easing: {\n    surface: "${v.surface}",\n    content: "${v.content}",\n  },`);
    }
    if (v.stagger !== DEFAULTS.stagger) lines.push(`  stagger: ${v.stagger},`);
    if (v.backgroundScale !== DEFAULTS.backgroundScale) lines.push(`  backgroundScale: ${v.backgroundScale === 1 ? "false" : v.backgroundScale},`);
    if (reduce) lines.push(`  reducedMotion: true,`);
    if (slow) lines.push(`  timeScale: 4, // for review only`);
    return lines.length ? `useMorph({\n${lines.join("\n")}\n});` : "useMorph(); // the defaults";
  }, [v, slow, reduce]);

  return (
    <div className="not-prose mcp-play">
      <LiveDemo options={options} theme={theme} onState={setState} hint="Tap a card" />
      <div className="mcp-panel">
        <fieldset className="mcp-group">
          <legend>Duration</legend>
          <Range label="Open" unit="ms" min={150} max={1200} step={10} value={v.open} onChange={(n) => set("open", n)} />
          <Range label="Close" unit="ms" min={120} max={1000} step={10} value={v.close} onChange={(n) => set("close", n)} />
          <Range label="Stagger" unit="ms" min={0} max={150} step={5} value={v.stagger} onChange={(n) => set("stagger", n)} />
          <Range
            label="List scale"
            min={0.9}
            max={1}
            step={0.01}
            value={v.backgroundScale}
            format={(n) => (n === 1 ? "off" : n.toFixed(2))}
            onChange={(n) => set("backgroundScale", n)}
          />
        </fieldset>
        <fieldset className="mcp-group">
          <legend>Easing</legend>
          <Select label="Surface" value={v.surface} options={EASINGS.surface} onChange={(s) => set("surface", s)} />
          <Select label="Content" value={v.content} options={EASINGS.content} onChange={(s) => set("content", s)} />
        </fieldset>
        <fieldset className="mcp-group is-row">
          <legend>View</legend>
          <Toggle on={slow} onClick={() => setSlow((x) => !x)}>
            4× slower
          </Toggle>
          <Toggle on={reduce} onClick={() => setReduce((x) => !x)}>
            Reduced motion
          </Toggle>
          <div className="mcp-seg" role="group" aria-label="Demo theme">
            {(["site", "light", "dark"] as const).map((t) => (
              <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>
                {t === "site" ? "Site" : t === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="mcp-foot">
          <span className="mcp-state" aria-live="polite">
            state <code data-state={state}>{state}</code>
          </span>
          <button
            type="button"
            className="mcp-reset"
            onClick={() => {
              setV(DEFAULTS);
              setSlow(false);
              setReduce(false);
              setTheme("site");
            }}
          >
            Reset
          </button>
        </div>
        <pre className="mcp-code">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function Range({
  label,
  unit,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="mcp-range">
      <span className="mcp-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.currentTarget.value))} />
      <output className="mcp-value">
        {format ? format(value) : value}
        {unit && !format ? <small> {unit}</small> : null}
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
      <code className="mcp-curve">{value}</code>
    </label>
  );
}
