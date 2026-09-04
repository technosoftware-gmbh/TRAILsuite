/**
 * The nutrition cells of the meal header: four figures and the caption that
 * says what they are figures *of*.
 *
 * The caption is not decoration. The same four numbers mean different things
 * depending on two settings, and a meal that states nutrition but no
 * servings cannot be converted at all. Showing 600 kcal with no indication of
 * whether that is a plate or a tray is the failure this exists to prevent.
 *
 * App-free.
 */
import { t } from '../../lang/I18nManager';
import type { CULItrailSettings } from '../../settings/types';
import type { MealMeta, MealNutrition } from '../types';
import { displayedNutrition } from './nutrition-basis';

/** The grams suffix. A canonical unit abbreviation, deliberately not translated. */
const GRAMS = 'g';

/**
 * Shown for a figure the note does not state, so the grid keeps its shape.
 *
 * An en dash, not an em dash. This was an em dash, which broke the plugin's own
 * "no em dashes in shipped text" rule in the one place that rule is easiest to
 * miss: a one-character constant that renders on screen. Exported because the
 * gallery card needs the same mark for the same meaning, and two files disagreeing
 * about which dash means "nothing recorded" is worse than either choice.
 */
export const ABSENT_FIGURE = '–';

export interface NutritionCell {
  label: string;
  text: string;
}

export interface NutritionRow {
  cells: NutritionCell[];
  /** "Per serving", "Whole meal", or the honest version when nothing could be converted. */
  caption: string;
}

/** Rounds to something a label can carry: a whole number when it is one, one decimal otherwise. */
function formatFigure(value: number): string {
  return Math.abs(value - Math.round(value)) < 0.05 ? String(Math.round(value)) : value.toFixed(1);
}

/**
 * One cell.
 *
 * Takes the resolved label rather than a translation key, so every `t()` call
 * sits at a call site the translation-key test can find by scanning. A key
 * passed as an argument is invisible to it, and the whole point of that test
 * is that a key nothing asks for gets noticed.
 */
function cell(label: string, value: number | null, unit: string): NutritionCell {
  return {
    label,
    text: value === null ? ABSENT_FIGURE : `${formatFigure(value)}${unit ? ` ${unit}` : ''}`,
  };
}

function statesSomething(values: MealNutrition): boolean {
  return Object.values(values).some((value) => value !== null);
}

export interface NutritionRowOptions {
  /**
   * Abbreviated labels, for a gallery card.
   *
   * Four columns across a 190px card is about 42px each, and "Calories" needs
   * more than that on one line. A label that wraps makes the card taller than
   * its neighbours, which in a grid means the whole row grows. Abbreviating is
   * what the product cards this was modelled on do, for the same reason.
   */
  short?: boolean;
}

/**
 * The nutrition row, or null when the meal states nothing at all.
 *
 * Null rather than four dashes, so the header of a meal that says nothing
 * about nutrition does not carry an empty grid announcing it.
 */
export function nutritionRow(
  meta: MealMeta,
  settings: CULItrailSettings,
  options: NutritionRowOptions = {}
): NutritionRow | null {
  if (!statesSomething(meta.nutrition)) return null;

  const shown = displayedNutrition(meta, settings);
  const short = options.short === true;

  // Both label sets are resolved at their own call site rather than through a
  // key built from a flag, so `tests/translation-keys.test.ts` can find all
  // eight by scanning. A key passed as a variable is invisible to it.
  return {
    cells: [
      cell(
        short ? t('meals.nutrition.shortCalories') : t('meals.nutrition.calories'),
        shown.values.calories,
        ''
      ),
      cell(
        short ? t('meals.nutrition.shortProtein') : t('meals.nutrition.protein'),
        shown.values.protein,
        short ? '' : GRAMS
      ),
      cell(
        short ? t('meals.nutrition.shortFat') : t('meals.nutrition.fat'),
        shown.values.fat,
        short ? '' : GRAMS
      ),
      cell(
        short ? t('meals.nutrition.shortCarbs') : t('meals.nutrition.carbs'),
        shown.values.carbs,
        short ? '' : GRAMS
      ),
    ],
    caption: nutritionCaption(shown.perServing, shown.unconverted),
  };
}

function nutritionCaption(perServing: boolean, unconverted: boolean): string {
  // The unconverted caption names the basis the numbers are actually on,
  // which is the stored one. Saying "per serving" over figures that could not
  // be divided would be a straightforwardly wrong label.
  if (unconverted) {
    return perServing ? t('meals.nutrition.storedPerServing') : t('meals.nutrition.storedTotal');
  }
  return perServing ? t('meals.nutrition.perServing') : t('meals.nutrition.total');
}
