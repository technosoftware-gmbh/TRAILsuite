/**
 * Converting a meal's nutrition figures between the two bases a note can
 * state them in.
 *
 * Two settings, easily confused, doing different jobs. `nutritionSource` says
 * what the numbers in the note **mean**; `nutritionDisplay` says what the
 * reader wants to **see**. They are separate because a vault's meals are
 * written one way and read another, and the reader should not have to do the
 * arithmetic.
 *
 * App-free.
 */
import type { CULItrailSettings } from '../../settings/types';
import type { MealMeta, MealNutrition } from '../types';

export interface DisplayedNutrition {
  values: MealNutrition;
  /** True when the figures below are per serving rather than for the whole pack. */
  perServing: boolean;
  /**
   * True when the note's figures are shown as stored because they could not be
   * converted.
   *
   * Converting needs a servings count, and a meal that states nutrition but no
   * servings is common. Showing the stored numbers under an honest label beats
   * showing nothing, and beats silently dividing by one and calling a whole
   * tray a portion.
   */
  unconverted: boolean;
}

export function displayedNutrition(
  meta: MealMeta,
  settings: CULItrailSettings
): DisplayedNutrition {
  const perServing = settings.nutritionDisplay === 'per-serving';
  const storedPerServing = settings.nutritionSource === 'per-serving';
  const servings = meta.servings;

  if (perServing === storedPerServing) {
    return { values: meta.nutrition, perServing, unconverted: false };
  }

  if (servings === null || servings <= 0) {
    return { values: meta.nutrition, perServing: storedPerServing, unconverted: true };
  }

  const factor = perServing ? 1 / servings : servings;
  return { values: scaleNutrition(meta.nutrition, factor), perServing, unconverted: false };
}

function scaleNutrition(nutrition: MealNutrition, factor: number): MealNutrition {
  const scale = (value: number | null): number | null =>
    value === null ? null : Math.round(value * factor * 10) / 10;

  return {
    calories: scale(nutrition.calories),
    protein: scale(nutrition.protein),
    fat: scale(nutrition.fat),
    carbs: scale(nutrition.carbs),
  };
}
