/**
 * The rules the nutrition form follows, kept apart from the DOM that shows them.
 *
 * Same split as `supplier-options.ts`: what a control offers and what a typed
 * word resolves to are decisions worth testing, and neither of them can be
 * tested through `createEl`, which does not exist outside Obsidian. The view
 * attaches inputs to what this returns.
 *
 * App-free.
 */
import {
  defaultUnitFor,
  matchNutrient,
  MACRONUTRIENT_IDS,
  per100g,
  type MealNutritionPer100g,
  type NutrientEntry,
  type ServingTotals,
} from '@technosoftware/trail-core';

/** A row naming a nutrient with no figure yet, which is a real thing to say. */
export function blankEntry(id: string): NutrientEntry {
  return { name: id, unit: defaultUnitFor(id), value: null };
}

/**
 * The known ids a list can still be given a row for.
 *
 * Filtered against what the list already holds, because a declaration names each
 * nutrient once and offering `fat` again on a meal that has it invites two rows
 * that disagree. Nothing stops somebody typing a second one: this decides what
 * is **suggested**, not what is allowed.
 */
export function unusedNutrientIds(
  known: readonly string[],
  entries: readonly NutrientEntry[]
): string[] {
  const taken = new Set(entries.map((entry) => entry.name));
  return known.filter((id) => !taken.has(id));
}

/**
 * A row after somebody has retyped its name.
 *
 * The typed word goes through `matchNutrient`, so `Fett`, `of which sugars` and
 * `saturatedFat` all resolve to the id the note is written in, and a word the
 * table has never heard of keeps its spelling exactly. That is what lets a vault
 * track something nobody anticipated without the form quietly dropping it.
 *
 * The unit is filled in from the nutrient only when the row has none. A unit
 * already on a row is what a packet said, and a figure whose unit was replaced
 * by the usual one is off by a factor of a thousand with nothing looking wrong.
 */
export function renamedEntry(entry: NutrientEntry, typed: string): NutrientEntry {
  const name = matchNutrient(typed).id;
  const unit = entry.unit.trim() === '' ? defaultUnitFor(name) : entry.unit;
  return { ...entry, name, unit };
}

/** The per-serving figure the seeded breakdown divides, for the three it has. */
function statedTotal(id: string, totals: ServingTotals): number | null {
  if (id === 'protein') return totals.protein;
  if (id === 'fat') return totals.fat;
  if (id === 'carbs') return totals.carbs;
  return null;
}

/**
 * The breakdown a meal starts with when somebody adds one.
 *
 * **All six EU-declaration macronutrients, in the regulation's order, values
 * blank where nothing is known.** A list somebody has to build a row at a time
 * before they can type a number is a list nobody fills in, and the six are what
 * every packet in this library prints. Building the rows costs a note six names
 * and no figures, and a name with no figure is exactly what it is: this meal has
 * fibre in it and nobody has measured it.
 *
 * **Salt, and only salt, among the micronutrients.** It is the one micronutrient
 * a label must declare, and it is the row 126 of the 127 meals in this vault
 * already carry: blank on 105 of them, with a figure on 21. Seeding the rest of
 * Annex XIII would put twenty-eight blank vitamins into a note to spare somebody
 * one click each on the two they have.
 *
 * Seeded from what is already typed, so the breakdown starts out agreeing with
 * the per-serving figures rather than empty. With no serving weight there is
 * nothing to divide by and every figure comes out null, which is the honest
 * answer: the arithmetic cannot be done, and a zero would say the meal contains
 * none of it.
 *
 * Kilojoules stay null even when the calories do not. The draft carries no
 * per-serving kJ to divide, and 4.184 kcal to the kJ is a conversion this form
 * has no business performing on somebody's behalf.
 */
export function seedBreakdown(
  totals: ServingTotals,
  servingGrams: number | null
): MealNutritionPer100g {
  return {
    caloriesPer100g: per100g(totals.calories, servingGrams),
    kjPer100g: null,
    macronutrients: MACRONUTRIENT_IDS.map((id) => ({
      ...blankEntry(id),
      value: per100g(statedTotal(id, totals), servingGrams),
    })),
    micronutrients: [blankEntry('salt')],
  };
}
