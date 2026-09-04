/**
 * The meal header's one strip of figures: nutrition first, then whatever the
 * badges resolved to.
 *
 * One strip rather than two, and that decision was made against a counted
 * library rather than in the abstract. Of 126 meal notes, 113 state nutrition
 * but no times and have been eaten, so a badges-only strip was a single column
 * reading "LAST MADE" over a date on ninety percent of the collection, while the
 * four nutrition figures every note carries sat in a separate band below. Merging
 * them is what makes the header say something.
 *
 * The cost is the one the design warned about: the nutrition caption ("per
 * serving") describes only its own columns. `groupStart` on the first badge cell
 * draws a rule between the two groups so the caption cannot read as covering the
 * times as well.
 *
 * App-free.
 */
import type { CULItrailSettings } from '../../settings/types';
import type { StatCell } from '../../ui/stat-strip';
import type { MealMeta } from '../types';
import { badgeCells } from './badge-display';
import type { PlannedBadge } from './badge-values';
import { nutritionRow } from './nutrition-row';

export interface HeaderStrip {
  cells: StatCell[];
  /**
   * What the nutrition figures are figures *of*, or null when the note states no
   * nutrition and there is therefore nothing for a caption to be about.
   */
  caption: string | null;
}

/**
 * Nutrition columns, then figure columns.
 *
 * Nutrition leads because that is the order a shop states a dish in, and because
 * the caption is left-aligned under the strip: with nutrition first, the caption
 * sits under the columns it describes rather than across the row from them.
 */
export function headerStrip(
  meta: MealMeta,
  settings: CULItrailSettings,
  figures: PlannedBadge[]
): HeaderStrip {
  const nutrition = nutritionRow(meta, settings);

  const cells: StatCell[] = (nutrition?.cells ?? []).map((cell) => ({
    label: cell.label,
    value: cell.text,
  }));

  const badges = badgeCells(figures);
  // Only when there is something on both sides of it. A rule at the start of the
  // strip would be a stray line, and one after a group nothing follows is the
  // same mistake the badge row's stranded separators are.
  if (badges.length > 0 && cells.length > 0) badges[0].groupStart = true;

  return { cells: [...cells, ...badges], caption: nutrition?.caption ?? null };
}
