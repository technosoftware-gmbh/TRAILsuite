/**
 * The editable shape of a meal note.
 *
 * The shape is `trail-core`'s: what a meal note holds is the note format rather
 * than this editor's model of it. Declaring it here instead would tie the
 * fields a meal carries to the form that happens to show them, and the notes
 * outlast the form. Imported rather than copied, and re-exported so every call
 * site keeps saying `from './types'`.
 *
 * App-free.
 */
export { emptyMealNutrition } from 'trail-core';
export type {
  MealDraft,
  MealNutritionPer100g,
  MealNutritionPerServing,
  NutrientEntry,
  ServingTotals,
} from 'trail-core';
