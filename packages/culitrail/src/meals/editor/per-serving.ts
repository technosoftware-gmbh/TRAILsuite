/**
 * Converting between a label's per-100 g figures and one serving's.
 *
 * Moved to `trail-core`, where it sits beside the model it converts.
 * `deriveServingNutrition` is the one the save and the live readout both go
 * through: it returns null for every figure when there is no serving weight to
 * multiply by, rather than treating a missing weight as zero grams.
 *
 * App-free.
 */
export { deriveServingNutrition, per100g, perServing, round2 } from 'trail-core';
