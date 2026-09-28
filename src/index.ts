// morphcard: a card that grows into a detail screen and shrinks back.
// useMorph is the main API. createMorph is the framework-free engine under
// it, exported for code outside React components.
export { type UseMorph, type UseMorphOptions, useMorph } from "./use-morph";
export {
  type CloseOptions,
  type Morph,
  type MorphOptions,
  type MorphPlan,
  type MorphState,
  type MorphTiming,
  type PairReport,
  type SkipReason,
  choreography,
  createMorph,
  defaults,
} from "./morph";
