# react-morphcard review — 2026-09-28

## Decision

Keep the WAAPI implementation for the card-to-mounted-sheet interaction. Its useful contract is reversible choreography, visibility-aware geometry, matching text/image treatment and cleanup behind a small React hook. That is a defensible scope. It does not justify replacing route transitions or building a general animation framework.

For a new route transition, start with the browser/router integration. For a React view replacement, evaluate React ViewTransition. For an app already using Motion and needing springs, gestures or layout animation, evaluate `layoutId` before adding this package. The updated [public comparison](../docs-site/content/docs/view-transitions.mdx) includes primary sources and current API caveats.

Do not introduce a second, native backend now. It would double lifecycle and fallback paths before demonstrating equivalent Back behaviour and visual results. A future prototype should pass the same interruption, visibility, scroll and cleanup cases before becoming a supported engine.

## Reproduced problems and changes

| Problem | Evidence / correction |
| --- | --- |
| City glyph abruptly grows during open | The card-only SVG was inherited by the expanding cover. Cover fill and glyph now have separate shared wrappers on both sides. First, intermediate and final rectangles are checked, including interrupted Back. |
| Scaled clipping ancestors misclassify cards | Screen rectangles were intersected with unscaled client sizes/borders. Visibility now converts both into screen pixels; shrinking and enlarging containers have regression coverage. |
| Same-task open/close leaves a promise pending | A waiter was registered after a synchronous settle. Register it before reversing. |
| Zero-duration close can throw during reversal | Dividing by a zero duration produced an invalid playback rate. Settle synchronously when the destination duration is zero. |
| WebKit jumps on mid-open Back | Explicit `startTime` assignment changed composited transforms even when `currentTime` remained unchanged. Pause, preserve current time and let `play()` establish the browser's start time. |
| Changing background scale during open snaps at the end | The hold frame used new options instead of the scale used to build the run. Capture scale per session. |
| Invalid easing leaves the page inert | Restore closed state, animations, copies and attributes if measurement/building fails. A subsequent valid open works. |
| Mount-effect deep link silently fails | Queue the initial request until the engine exists; flush outside React effects. Superseded, closed and unmounted requests are resolved rather than retained. StrictMode is covered. |
| Escape closes an older demo underneath a newer panel | Track activation order per document. Only the top active sheet handles Escape; repeated Escape during close cannot dismiss a lower sheet. |
| First Anatomy Play stops at 400 / 525 ms | Playback captured stale React state. Use the measured duration of the newly armed run. |
| Mobile Anatomy controls push the preview offscreen | Use a compact sticky preview while operating controls. Verify actual clip-path keyframes rather than merely checking that the panel opens. |
| Documentation overstates VT disadvantages and modal guarantees | Replace the comparison with current browser/React/Motion behaviour. Distinguish focus return and a supplied inert background from a complete modal focus trap. |

The existing partial-card/centred-panel changes were retained. Partially visible cards use the visible region; fully hidden or missing cards fade. The fix does not scroll an invisible card into view merely to force a flight.

## Refactor boundaries

`src/morph.ts` was about 1,156 lines. It is now about 444 lines responsible for lifecycle, ownership, reversal, promises, focus and cleanup.

| Module | Responsibility |
| --- | --- |
| `use-morph.ts` | React refs/items, mount readiness, synchronous content commit, declarative options |
| `morph.ts` | State machine and ownership of an active session/run |
| `measure.ts` | Visibility decisions, source/destination measurements, pair plan |
| `animate.ts` | Build morph/fade keyframes and temporary card copies |
| `geometry.ts` | Pure rectangle, clipping, transform and fill calculations |
| `dom.ts` | DOM inspection, scroll/focus helpers and reversible mutations |
| `timing.ts` | One source for defaults, choreography and nominal durations |
| `layers.ts` | Document-local activation order for Escape |
| `types.ts`, `transition.ts` | API contracts and internal measured/run/session data |

The public React API is unchanged. `createMorph` remains internal. Package entry types/constants no longer route through the lifecycle module. Documentation imports public timing constants instead of copying them.

The refactor improves review and testing boundaries; it is not claimed to reduce runtime cost or bundle size. The emitted ESM currently measures 51.74 kB, 15.39 kB gzipped, excluding React and before a consumer's minification/tree shaking.

## Verification

- 306 E2E cases: 51 scenarios × two viewport sizes × Chromium, Firefox and WebKit.
- 41 unit/SSR tests, TypeScript check, package validation and Next static production build.
- Site interactions: 14 cases covering city, feature, video, code, documentation topic, playground and embedded-phone cards on desktop and phone.
- Glyph geometry: 18 cases across three engines, two viewports and centre/top/bottom card positions. Every case checks opening, Back and interrupted Back.
- Anatomy: first Play reaches the actual 525 ms end, close reaches 300 ms, keyboard scrubbing pauses/seeks the real animations, and the page has no horizontal overflow.

E2E coverage includes repeated open/close, retargeting, unmount while opening/closing, StrictMode, live options, scroll/focus return, missing/offscreen elements, reduced motion, fixed descendants, zero duration, failures during construction and scaled clipping containers.

Reproduce the engine checks:

```sh
pnpm typecheck
pnpm test
pnpm check:package
pnpm build:examples
MORPHCARD_BROWSERS=chromium,firefox,webkit pnpm exec playwright test
```

Build and serve `docs-site/out`, then set `BASE` for `scripts/docs-morph-check.mjs`, `scripts/docs-logo-check.mjs` and `scripts/docs-anatomy-check.mjs`. The latter two accept `BROWSER=firefox` or `BROWSER=webkit`.

## Remaining boundaries / next work

- This is not a complete dialog primitive. Focus return and background `inert` do not provide a general Tab trap, top-layer stacking or inertness for every sibling. Keep modal integration separate and test it with the actual surrounding application.
- Measurements are snapshots taken at transition boundaries. Images/fonts or layout changes after measurement can invalidate them. Reserve media dimensions and load the final typography before opening; continuous retargeting during arbitrary layout changes is not implemented.
- Geometry assumes axis-aligned boxes and uniform scaling of the sheet's ancestors. Arbitrary rotation/skew, perspective, nested shared transforms and CSS masks require separate design/coverage; this review does not certify them.
- Keep state callbacks observational; reentrant lifecycle commands from `onStateChange` need a dedicated contract and test suite before being advertised.
- Browser-engine tests include phone-sized/touch contexts, not physical iPhones, Android WebViews, screen readers, mobile keyboard/visual-viewport behaviour or old embedded engines.
- No device-level frame-time, paint or memory benchmark was performed. The result supports correctness in the tested cases, not a claim that WAAPI is universally faster than View Transitions.

The next valuable performance change would be profiling real content, then reducing repeated DOM/style reads if the trace shows they matter. Adding an animation abstraction or backend switch without that evidence is unlikely to help this interaction.
