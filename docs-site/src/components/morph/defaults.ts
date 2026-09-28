import { defaults } from "react-morphcard";

// The playground and the package reset to the same values.
export const MORPH_DEFAULTS = defaults;

export type MorphTuning = Partial<typeof MORPH_DEFAULTS>;
