/**
 * The editable shape of a meal note.
 *
 * Written for CULItrail's editor and kept here rather than in it, because the
 * fields listed below are what a meal note holds: they are the format's, not
 * any one editor's. Which figures a meal carries is decided by the notes in a
 * vault, and a form is free to show, hide or reorder them without that changing.
 *
 * A draft, not a model: it is what the editor holds between opening a note
 * and saving it, so every field is the form's own type rather than the note's.
 */

import type { MealNutritionPer100g } from './nutrition-model.js';

/**
 * The label's figures, per 100 g, as the two retired body sections carried them.
 *
 * Not what a draft holds any more: eight fixed fields are a form's shape rather
 * than a note's, and `MealNutritionPer100g` replaced them. It stays exported
 * because the legacy readers in `nutrition.ts` are typed in it, and those read
 * every meal written before the move.
 */
export interface Per100gNutrition {
  calories: number | null;
  kj: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  salt: number | null;
  sugar: number | null;
  saturatedFat: number | null;
}

/** Nutrition as the frontmatter carries it, which is per serving. */
export interface ServingTotals {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

export interface MealDraft {
  /** The free text between the frontmatter and the first heading. */
  description: string;
  prepTime: number | null;
  reheatTime: number | null;
  totalTime: number | null;
  servings: number | null;
  /** What one portion costs to order. Typed, never derived. */
  price: number | null;
  /**
   * The company this meal is ordered from, as a **note title** rather than a
   * wikilink: the wikilink is a storage detail the form has no reason to carry.
   * Null when the note names none.
   */
  supplier: string | null;
  /**
   * Which of the supplier's ranges this meal belongs to.
   *
   * A company sells the same dish under several lines with different nutrition
   * and different prices, which makes them different meals sharing a name. The
   * draft carries the line as typed rather than as a choice, because the list a
   * company publishes is a vault fact the form resolves, not part of the note
   * format.
   */
  line: string | null;
  /**
   * The currency `price` is in, when the note states one.
   *
   * Null is the common case: the currency is normally the supplier's, stated
   * once on their own note, and this is the per-meal override.
   */
  priceCurrency: string | null;
  diet: string;
  /** Comma-separated, because that is how a list is typed into one field. */
  allergens: string;
  /**
   * The picture of the dish, as the note states it.
   *
   * A wikilink or a vault path, kept exactly as written rather than resolved:
   * resolving is the reader's job and a form that rewrote the shape would turn
   * every hand-written `[[x.jpg]]` into a path on the next save.
   *
   * Empty when the note has none. The gallery and the meal view have read this
   * property since before there was an editor; the editor is what could not
   * set it.
   */
  image: string;
  /**
   * Whether this note states what 100 g of it contains.
   *
   * When it does, the per-serving figures are **computed** from the breakdown
   * and the serving weight on save rather than typed: a label states per 100 g,
   * and the per-serving numbers are arithmetic over that. When it does not, the
   * per-serving figures are typed directly and nothing is derived.
   *
   * True for a note whose frontmatter carries the breakdown and for one that
   * still keeps it in the two old body sections. Either source is a note that
   * means its figures per 100 g, and reading one of them as per-serving would
   * multiply the whole label by the serving weight on the next save.
   */
  hasPer100g: boolean;
  per100g: MealNutritionPer100g;
  /** Grams in one serving, which is what converts between the two halves above. */
  servingGrams: number | null;
  totals: ServingTotals;
}

/** The empty legacy record. `emptyMealNutrition()` is what a draft starts from. */
export function emptyPer100g(): Per100gNutrition {
  return {
    calories: null,
    kj: null,
    protein: null,
    fat: null,
    carbs: null,
    salt: null,
    sugar: null,
    saturatedFat: null,
  };
}
