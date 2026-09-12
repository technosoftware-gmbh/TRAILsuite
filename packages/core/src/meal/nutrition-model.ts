/**
 * What a meal note says about 100 g of itself.
 *
 * This replaces the eight fixed fields of `Per100gNutrition`. The fields were a
 * form's shape rather than a note's: a label that also declares fibre, or iron,
 * or nothing but salt, had nowhere to put what it said, and a meal could only
 * ever carry the exact eight figures one editor had boxes for. Two lists and two
 * scalars carry all of that and stay readable.
 *
 * **Energy is two named scalars, not two list entries.** Calories and kilojoules
 * are what the nutrients add up to rather than nutrients, so a list is the wrong
 * container for them; and the names are `caloriesPer100g` and `kjPer100g` in
 * full because the frontmatter's `calories` and `kj` are per serving, the two get
 * read within a line of each other, and a field called `calories` in a per-100 g
 * record is a bug waiting for somebody in a hurry.
 *
 * **Macronutrients and micronutrients are separate lists** because a note keeps
 * them under separate headings and a form shows them in separate blocks. Nothing
 * here enforces that a given id is in the list its name suggests: a note that put
 * iron among the macros is a note this package can still read, and rearranging
 * somebody's file to match a category we invented is not a fix.
 */
import type { NutrientEntry } from './nutrients.js';

export interface MealNutritionPer100g {
  caloriesPer100g: number | null;
  kjPer100g: number | null;
  macronutrients: NutrientEntry[];
  micronutrients: NutrientEntry[];
}

/**
 * The per-serving figures the frontmatter carries.
 *
 * Five, not the whole breakdown, because these are the properties a vault
 * queries and charts. The breakdown stays per 100 g, where a label states it.
 */
export interface MealNutritionPerServing {
  calories: number | null;
  kj: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

/** Fresh arrays every call: two drafts must never share a nutrient list. */
export function emptyMealNutrition(): MealNutritionPer100g {
  return {
    caloriesPer100g: null,
    kjPer100g: null,
    macronutrients: [],
    micronutrients: [],
  };
}

/**
 * True when the note states nothing at all about 100 g of itself.
 *
 * A row with a name and no figure counts as something stated: somebody wrote
 * that this meal has salt in it and has not measured it yet, which is a
 * different note from one that never mentioned salt. So this asks whether there
 * is any row and any energy figure, not whether any figure is non-null. It is
 * what decides whether a note gets a breakdown written into it at all.
 */
export function isEmptyMealNutrition(nutrition: MealNutritionPer100g): boolean {
  return (
    nutrition.caloriesPer100g === null &&
    nutrition.kjPer100g === null &&
    nutrition.macronutrients.length === 0 &&
    nutrition.micronutrients.length === 0
  );
}

/**
 * The figure a list states for one nutrient id, or null.
 *
 * First match wins. A list holding the same id twice is a note somebody
 * hand-edited into an odd state, and taking the first is at least the same
 * answer every time, which summing or taking the last would not be.
 */
export function nutrientValue(entries: readonly NutrientEntry[], id: string): number | null {
  return entries.find((entry) => entry.name === id)?.value ?? null;
}
