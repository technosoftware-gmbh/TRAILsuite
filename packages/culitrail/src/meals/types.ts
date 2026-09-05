/**
 * The meal area's read-time domain model.
 *
 * Nothing here is persisted. These are the shapes the parser produces from a
 * note, rebuilt on every read, which is why they live with the area rather
 * than in `settings/types.ts` alongside the things `data.json` holds.
 */
import type { MealNutritionPer100g } from '@technosoftware/trail-core';
import type { EatingEntry } from './parser/eating-history';

export type { EatingEntry };

/** A run of steps under an optional sub-heading. */
export interface StepGroup {
  heading: string | null;
  headingLevel: number;
  steps: string[];
}

/** The nutrition figures a meal note can carry. */
export interface MealNutrition {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

/**
 * Everything the meal view reads out of frontmatter.
 *
 * Every field is nullable because every field is optional in a real note. A
 * note with a title and nothing else is a complete meal as far as CULItrail
 * is concerned.
 */
export interface MealMeta {
  image: string | null;
  servings: number | null;
  prepTime: number | null;
  reheatTime: number | null;
  /** Stated on the note, or null. The derived prep-plus-cook total is computed by the caller, never written back. */
  totalTime: number | null;
  diet: string[];
  allergens: string[];
  tags: string[];
  favorite: boolean;
  /** The log the note's frontmatter carries, newest first. The body's log is read by the view, which has the body. */
  eatingHistory: EatingEntry[];
  lastEaten: string | null;
  eatenCount: number | null;
  source: string | null;
  nutrition: MealNutrition;
  /**
   * What the packet says about 100 g of the dish: two energy figures and two
   * lists of nutrients.
   *
   * Separate from `nutrition` above, and not the same claim. Those four are per
   * serving; this is the label, and a meal can carry both with neither saying
   * what the other says. It is also the only field here that can come from the
   * note's body rather than its frontmatter, because a meal written before the
   * breakdown moved into properties keeps it under two headings, and a caller
   * that has the body gets those read for it. See `parser/per100g.ts`.
   */
  per100g: MealNutritionPer100g;
  /** What one portion costs, as sold. */
  price: number | null;
  /**
   * The currency `price` is in, when the note states one.
   *
   * Null is the common case and not a gap: the currency is resolved through a
   * chain, and this is only its first link. See `view-model/currency.ts`.
   */
  priceCurrency: string | null;
  /**
   * Which of the supplier's ranges this meal belongs to, e.g. Alltag or Sport.
   *
   * A company sells the same dish under several lines with different nutrition
   * and different prices, which makes them different meals that share a name.
   * Null for a company that sells one range, or a note that has not said.
   */
  line: string | null;
}
