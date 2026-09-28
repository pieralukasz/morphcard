// react-morphcard: a card that grows into a detail screen and shrinks back.
// The public API is the useMorph hook. The engine it drives (./morph) is
// internal and not exported from the package.
export {
  type MorphInstance,
  type MorphKey,
  type MorphTarget,
  type UseMorph,
  type UseMorphCloseOptions,
  type UseMorphOptions,
  useMorph,
} from "./use-morph";
export {
  type MorphPlan,
  type MorphState,
  type MorphTiming,
  type PairReport,
  type SkipReason,
} from "./types";
export { choreography, defaults } from "./timing";
