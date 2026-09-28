# Animation setup performance — 2026-09-28

## Result

The main bottleneck was interleaving `Element.animate()` with computed-style reads for subsequent content blocks. More staggered blocks caused more synchronous style recalculations. The optimization builds the animation descriptions first and starts their effects after the DOM/style reads finish.

Across two runs with reversed variant order, the rich-sheet fixture went from 77 to 13 style recalculations per complete open/close cycle. Its median synchronous opening setup fell from 158–168 ms to 25–27 ms at 4× CPU throttling. The actual delivery demo showed a smaller, noisier improvement, so the rich-sheet result must not be presented as a universal speedup.

| Scenario | Open before → after (median ms) | Close before → after (median ms) |
| --- | --- | --- |
| Actual delivery demo | 10.2–11.8 → 8.7–10.0 | 6.8–8.3 → 5.2–6.1 |
| Small fixture: 6 cards, 4 shared elements, 4 blocks | 10.1–10.7 → 5.0–6.1 | 8.1–8.6 → 3.5–3.9 |
| Large list: 200 cards, 4 shared elements, 4 blocks | 16.0–16.2 → 13.5–13.7 | 12.9–14.0 → 10.6–10.9 |
| Rich sheet: 30 cards, 24 shared elements, 32 blocks | 158.1–168.2 → 25.0–27.4 | 137.7–158.8 → 14.5–16.1 |

Ranges are the two run medians, not confidence intervals. Full p95 values and browser counters are in [performance-results.json](performance-results.json).

## Changes

- `animate.ts`: queue keyframe descriptions while collecting DOM information, then create all effects together. They still start synchronously within the original call; no extra frame, timeout or changed duration was added. Errors during effect creation still clean up already-created animations and the ghost.
- `measure.ts` / `dom.ts`: index shared elements once per side instead of querying the entire subtree for each key. Each measurement creates fresh maps so replaced cards, changed content and offscreen decisions remain current. Duplicate keys retain the first eligible element, as before.
- Read a text element's computed style once for its font, line count and clipping checks instead of requesting it separately for each check.
- Index ghost pairs once and compute image fill keyframes once per pair, reusing the result for both copies.

In the rich-sheet fixture, `querySelectorAll` calls fell from 105 to 11 per cycle. Layout count remained 7 per cycle: this change principally removes repeated style recalculation, not all layout work. The emitted package grew from about 15.39 to 15.47 kB gzipped; this is a runtime optimization, not a bundle-size reduction.

## Method and reproducibility

Local headless Chromium, 1280×800 viewport, CDP CPU throttling at 4×, five warm-up cycles and 30 measured cycles per scenario and variant. Two comparisons ran in opposite variant order without parallel test/build workloads. The real demo includes its existing `prepare` callback; synthetic fixtures use an already-mounted detail. Geometry/content in the fixtures is identical between variants.

Timing measures only the synchronous `open()` / `close()` call. Animations are then finished immediately and their completion promises awaited before the next sample. Browser layout/style counters cover the full cycle including cleanup. API-call instrumentation runs separately from the timing samples.

This does not measure sustained FPS, GPU/raster cost, React rendering, input-to-paint, physical phones or memory use. A 4× CPU throttle is not a model of a specific device. Reduced setup work should help responsiveness, but that user-facing effect still needs device profiling.

```sh
pnpm build:examples
# Before editing the engine, preserve a baseline bundle outside the cleaned output directory:
cp examples/dist/engine.js /tmp/morph-perf-baseline.js
# After editing, build again and run the example server in another terminal:
PORT=3301 node scripts/serve.mjs
CPU=4 SAMPLES=30 OUT=/tmp/comparison.json node scripts/perf-check.mjs \
  /tmp/morph-perf-baseline.js examples/dist/engine.js
# Repeat with the two paths reversed.
```

The baseline for these results is the local engine after the preceding correctness/refactor review, before this optimization. Its bundle SHA-256 is recorded with the results; it is not the earlier git HEAD.

## Next useful work

1. Profile input-to-first-paint and long frames on physical iOS/Android devices with real images, video, fonts and page content. The remaining paint/compositor cost is outside this benchmark.
2. For very large lists, evaluate `backgroundScale: false` and a bounded/virtualized list in the consuming app. The engine currently inspects background descendants to avoid moving fixed children; the large-list fixture still pays that cost.
3. Keep expensive React detail rendering separate from the engine measurement. Preload media and reserve image dimensions; profile the synchronous detail commit before adding memoization or changing the item API.
4. Retain fresh measurements for Back. Cross-transition geometry caches need explicit invalidation for scrolling, resizing, React replacements and font/media changes; avoid trading the fixed visibility bugs for stale measurements.

Regression validation covers all three engines, interrupted Back, zero timing, hidden/scaled cards, fixed content/dock descendants and failures partway through the queued animation batch. Site checks retain the glyph's first/intermediate/last-frame assertions.

Validation result: 318 E2E cases passed across Chromium/Firefox/WebKit, plus 41 unit/SSR tests, TypeScript and package checks, and the Next production build. Visual site checks cover 14 interactions, 18 glyph cases and two timeline viewports.
