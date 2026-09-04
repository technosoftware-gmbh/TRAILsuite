/**
 * Converting between a label's per-100 g figures and one serving's.
 *
 * Three functions and a rounder, kept apart from everything else because this
 * is the whole of the arithmetic the editor does and it is the part worth
 * being able to read at a glance.
 */
import {
  nutrientValue,
  type MealNutritionPer100g,
  type MealNutritionPerServing,
} from './nutrition-model.js';

/**
 * Two decimal places.
 *
 * Not zero: a quarter-serving of something can carry a real 3.25 g of fat,
 * and rounding it to 3 across every field of every meal adds up to a lie.
 * Not more: nothing on a nutrition label is stated to more than that.
 */
export function round2(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

/** What `grams` of something contains, given its per-100 g figure. */
export function perServing(per100g: number | null, grams: number): number | null {
  return per100g === null ? null : (per100g * grams) / 100;
}

/**
 * The per-100 g figure implied by one serving's total.
 *
 * The inverse of the above, for turning a meal that only states per-serving
 * numbers into one that carries a breakdown. Null when the serving weight is
 * unknown or zero, because dividing by it would produce an infinity that then
 * gets written into a note.
 */
export function per100g(total: number | null, grams: number | null): number | null {
  if (total === null || grams === null || grams <= 0) return null;
  return round2((total * 100) / grams);
}

/**
 * The five per-serving figures a breakdown implies, given a serving weight.
 *
 * **Null everywhere when the weight is unknown or not positive**, and that is
 * the point of the function rather than a detail of it. The call site this
 * replaces read `draft.servingGrams ?? 0` and then multiplied, so a meal that
 * carried a full label and no serving weight derived `calories: 0` and wrote it
 * into the note. Zero is a claim: it says a portion of this contains no energy.
 * Null says the arithmetic cannot be done, which is exactly true, and it is the
 * caller's business what to show for it. Treating a missing divisor as zero is
 * the same mistake `per100g` above already refuses to make in the other
 * direction.
 *
 * The three macros are looked up by known id, so a note that spelled them in
 * German or in the old `Protein (g)` style has already been resolved by the time
 * it gets here. A macro the list does not state stays null rather than becoming
 * zero, for the same reason.
 */
export function deriveServingNutrition(
  nutrition: MealNutritionPer100g,
  servingGrams: number | null
): MealNutritionPerServing {
  if (servingGrams === null || servingGrams <= 0) {
    return { calories: null, kj: null, protein: null, fat: null, carbs: null };
  }

  const scale = (value: number | null): number | null => round2(perServing(value, servingGrams));

  return {
    calories: scale(nutrition.caloriesPer100g),
    kj: scale(nutrition.kjPer100g),
    protein: scale(nutrientValue(nutrition.macronutrients, 'protein')),
    fat: scale(nutrientValue(nutrition.macronutrients, 'fat')),
    carbs: scale(nutrientValue(nutrition.macronutrients, 'carbs')),
  };
}
