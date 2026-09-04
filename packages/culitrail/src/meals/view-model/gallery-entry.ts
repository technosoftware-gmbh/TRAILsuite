/**
 * One meal as the gallery needs it, read once.
 *
 * The filters and the comparators both work off this rather than off a file
 * and a metadata cache. That is the whole point of it: sorting a thousand
 * meals by rating calls its comparator thousands of times, and re-reading
 * and re-parsing frontmatter inside a comparator turns a cheap sort into a
 * visible pause. Everything an entry needs is gathered once per render.
 *
 * App-free.
 */
import type { TFile } from 'obsidian';
import type { MealSupplier } from '../reheating/read-supplier';
import type { MealMeta } from '../types';

export interface GalleryEntry {
  file: TFile;
  /** The filename without its extension. What the search matches and the title sorts by. */
  title: string;
  /** The containing folder's path, or '' for a meal at the vault root. */
  folder: string;
  /** Frontmatter tags, the same ones the meal header shows. */
  tags: string[];
  meta: MealMeta;
  /** Creation and modification times, for the two date sorts. */
  createdAt: number;
  modifiedAt: number;
  /**
   * Whether this meal has reheating instructions to show.
   *
   * Derived from the note's body and its supplier's, the same way the meal
   * view derives it, so a card and the view it opens cannot disagree.
   */
  hasReheating: boolean;
  /**
   * The company this meal comes from, and what it charges.
   *
   * Resolved once for the whole library rather than per card: the supplier can
   * come from the meal's own property or from the newest order naming it, and
   * working that out card by card would read every order note once per meal.
   */
  supplier: MealSupplier | null;
}

/**
 * True when a meal has never been eaten.
 *
 * A missing count and a count of zero are the same thing. They are not the
 * same *value*, which is why this is a function: a meal that has never been
 * eaten usually has no count property at all, so a plain `=== 0` would miss
 * precisely the meals the filter exists to find.
 */
export function neverEaten(meta: MealMeta): boolean {
  return (meta.eatenCount ?? 0) === 0;
}
