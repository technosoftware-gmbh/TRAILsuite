/**
 * The per-100 g breakdown as rows somebody reads: a label and a figure each.
 *
 * The four figures at the top of a meal are per serving and always the same
 * four. This is the other thing a note can say about its nutrition, and it is
 * open-ended: energy, then whatever nutrients the packet declared, in whatever
 * quantity of whichever unit. It was invisible until now, because the two body
 * sections it used to live in were never rendered by the view at all.
 *
 * **The nutrient names in a note are ids, not words.** `saturatedFat` is what
 * the file says in every vault; `nutrientDisplayName()` is what turns that into
 * "of which saturates" or "davon gesättigte Fettsäuren" according to the
 * language somebody chose. That is the whole reason the figures moved into
 * lists: a German vault used to read English text frozen into every note.
 *
 * App-free, and returns text rather than DOM, so what the section says can be
 * asserted without rendering anything.
 */
import {
  inNutrientOrder,
  type MealNutritionPer100g,
  type NutrientEntry,
} from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { nutrientDisplayName } from '../../lang/vocabulary';
import { ABSENT_FIGURE } from './nutrition-row';

/**
 * The two energy units. Canonical abbreviations, deliberately not translated,
 * the same rule `GRAMS` follows in `nutrition-row.ts`. Every other unit here
 * comes off the entry, because the packet stated it.
 */
const KCAL = 'kcal';
const KILOJOULE = 'kJ';

/** One line of the table. */
export interface BreakdownRow {
  label: string;
  /** The figure with its unit, or `ABSENT_FIGURE` for a nutrient stated without one. */
  value: string;
  /**
   * Marks this row as the first of a new group, drawn with a rule above it.
   *
   * The same idiom as `StatCell.groupStart`, and for the same reason: energy,
   * macronutrients and micronutrients are three groups of one table rather than
   * three tables, which is how a packet prints them. A rule says where one ends
   * without spending a heading, and without asserting a category the note may
   * not agree with: nothing rearranges an entry between the two lists, so a
   * note that filed iron under the macros shows it there.
   */
  groupStart?: boolean;
}

/**
 * The figure, rounded only where rounding is honest.
 *
 * Deliberately not `nutrition-row.ts`'s formatter, which floors at one decimal
 * because it fills four fixed columns with per-serving figures in the hundreds.
 * A breakdown states what a label states, and a label states micronutrients in
 * hundredths: 0.05 mg of thiamin at one decimal reads as 0.1, and 0.02 reads as
 * 0. Two decimals with the trailing zeros dropped shows 7.1 as `7.1` and 0.02
 * as `0.02`, which is what the packet said in both cases.
 */
function formatFigure(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * A nutrient row.
 *
 * **A null value is absent, never zero.** A note naming salt without measuring
 * it is a different note from one stating no salt at all, and rendering the
 * first as `0 g` would be the view inventing a measurement. `ABSENT_FIGURE` is
 * the shared en dash, imported rather than respelt, so the breakdown and the
 * header strip cannot disagree about what "nothing recorded" looks like.
 *
 * **The unit is the one the entry carries**, not one derived from the name.
 * Iron is usually mg and occasionally µg, and assuming the usual would be out
 * by a factor of a thousand with nothing looking wrong.
 */
function nutrientRow(entry: NutrientEntry): BreakdownRow {
  const unit = entry.unit.trim();
  return {
    label: nutrientDisplayName(entry.name),
    value:
      entry.value === null
        ? ABSENT_FIGURE
        : `${formatFigure(entry.value)}${unit ? ` ${unit}` : ''}`,
  };
}

/**
 * Every row the breakdown has, in the order a label prints them, or none.
 *
 * Empty rather than a table of dashes when the note says nothing: a meal with
 * no packet figures should not carry an empty frame announcing that, which is
 * the same rule `nutritionRow()` follows for the header.
 *
 * **Sorting happens here and nowhere else.** The lists are stored in whatever
 * order the note wrote them and the writer deliberately leaves that alone, so
 * that reordering a list in the editor survives a save. Which order a *reader*
 * sees is a display decision, and `inNutrientOrder` is the declaration order of
 * Regulation (EU) 1169/2011 with anything it has never heard of kept, stable,
 * at the end of its own list.
 *
 * **An energy figure the note does not state gets no row.** Unlike a nutrient,
 * which is a row precisely because somebody named it, `caloriesPer100g` is a
 * scalar with no way of being named-but-unmeasured: null means nobody wrote it.
 */
export function nutritionBreakdown(per100g: MealNutritionPer100g): BreakdownRow[] {
  const rows: BreakdownRow[] = [];

  const push = (group: BreakdownRow[]): void => {
    if (group.length === 0) return;
    // Only ever between groups, so a breakdown that begins with its macros
    // does not draw a rule across the top of the card.
    if (rows.length > 0) group[0] = { ...group[0], groupStart: true };
    rows.push(...group);
  };

  const energy: BreakdownRow[] = [];
  if (per100g.caloriesPer100g !== null) {
    energy.push({
      label: t('meals.breakdown.calories'),
      value: `${formatFigure(per100g.caloriesPer100g)} ${KCAL}`,
    });
  }
  if (per100g.kjPer100g !== null) {
    energy.push({
      label: t('meals.breakdown.kilojoules'),
      value: `${formatFigure(per100g.kjPer100g)} ${KILOJOULE}`,
    });
  }

  push(energy);
  push(inNutrientOrder(per100g.macronutrients).map(nutrientRow));
  push(inNutrientOrder(per100g.micronutrients).map(nutrientRow));

  return rows;
}
