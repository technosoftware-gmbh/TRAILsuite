/**
 * The two per-100 g body sections: reading them, and writing them back.
 *
 * The format is a `- **Label:** value unit` list, which is what these vaults'
 * notes carry and what the packaged-food importer wrote before it was removed.
 * The reader is looser than the writer on purpose: it matches the label
 * case-insensitively, accepts the alternative names a hand-edited note ends up
 * with, and tolerates a line with no value at all.
 *
 * **This is the old format.** The per-100 g breakdown now lives in frontmatter as
 * two nutrient lists (`nutrition-model.ts`), and nothing in either plugin writes
 * these sections any more. The reader stays, and stays exported, for two reasons
 * that do not expire: the migration reads every existing note through it, and a
 * note nobody has migrated yet is still a note somebody opens.
 * `parseLegacyPer100gSections` at the bottom is the bridge between the two, and
 * it is where the format's one known mistake gets corrected.
 *
 * The two renderers stay too, with no caller left. They are the specification of
 * what the reader must read: they wrote the sections sitting in those vaults
 * today, so rendering and parsing back is the cheapest way to hold the reader to
 * the exact shape those notes carry, which is what `tests/meal/editor.test.ts`
 * does with them.
 */
import { emptyPer100g, type Per100gNutrition } from './draft.js';
import { defaultUnitFor, inNutrientOrder, type NutrientEntry } from './nutrients.js';
import { type MealNutritionPer100g } from './nutrition-model.js';

/**
 * `- **Calories:** 585.2 kcal`, with the value optional.
 *
 * The bold markers are optional in the pattern because a note somebody
 * cleaned up by hand loses them, and losing the whole section over two
 * asterisks would be the wrong trade.
 */
const FIELD_LINE = /^-\s+\*{0,2}([^*:]+?)\*{0,2}:\*{0,2}\s*(-?[\d.]+)?/;

/**
 * The label spellings each field answers to, lowercased.
 *
 * Named rather than inlined at the call sites because two things now read them:
 * the value readers below, and the legacy bridge, which needs to know whether a
 * section **mentioned** a nutrient at all and not only what figure it gave. Two
 * copies of these lists would drift, and the drift would show up as a nutrient
 * that reads back with a value but no row.
 */
const LEGACY_LABELS = {
  calories: ['calories'],
  kj: ['energy', 'kj'],
  protein: ['protein (g)', 'protein'],
  fat: ['fat (g)', 'fat'],
  carbs: ['carbohydrates (g)', 'carbs', 'carbohydrates'],
  // 'sodium' first because that is the label every note in the vault carries.
  // It is the wrong word for the figure under it; see the bridge below.
  salt: ['sodium', 'salt'],
  sugar: ['sugar'],
  saturatedFat: ['saturated fat'],
} as const satisfies Record<keyof Per100gNutrition, readonly string[]>;

function readFields(markdown: string): Map<string, number | null> {
  const fields = new Map<string, number | null>();

  for (const line of markdown.split('\n')) {
    const match = FIELD_LINE.exec(line.trim());
    if (!match) continue;

    const value = match[2] === undefined ? null : Number(match[2]);
    fields.set((match[1] ?? '').trim().toLowerCase(), Number.isFinite(value) ? value : null);
  }

  return fields;
}

function first(fields: Map<string, number | null>, ...labels: string[]): number | null {
  for (const label of labels) {
    if (fields.has(label)) return fields.get(label) ?? null;
  }
  return null;
}

/** The macronutrient section: calories, energy and the three macros. */
export function parseNutritionSection(markdown: string): Partial<Per100gNutrition> {
  const fields = readFields(markdown);
  return {
    calories: first(fields, ...LEGACY_LABELS.calories),
    kj: first(fields, ...LEGACY_LABELS.kj),
    protein: first(fields, ...LEGACY_LABELS.protein),
    fat: first(fields, ...LEGACY_LABELS.fat),
    carbs: first(fields, ...LEGACY_LABELS.carbs),
  };
}

/** The micronutrient section: what a label carries beyond the macros. */
export function parseMicronutrientSection(markdown: string): Partial<Per100gNutrition> {
  const fields = readFields(markdown);
  return {
    salt: first(fields, ...LEGACY_LABELS.salt),
    sugar: first(fields, ...LEGACY_LABELS.sugar),
    saturatedFat: first(fields, ...LEGACY_LABELS.saturatedFat),
  };
}

/** Both sections read into one record, with anything absent left null. */
export function parsePer100g(nutrition: string, micronutrients: string): Per100gNutrition {
  return {
    ...emptyPer100g(),
    ...parseNutritionSection(nutrition),
    ...parseMicronutrientSection(micronutrients),
  };
}

/**
 * A field line, written even when the value is missing.
 *
 * An empty `- **Sugar:** ` is a row somebody can fill in later. Dropping the
 * line instead would mean a note that has been through the editor once no
 * longer shows what it could hold.
 */
function line(label: string, value: number | null, unit: string): string {
  return value !== null ? `- **${label}:** ${value}${unit}` : `- **${label}:** `;
}

/**
 * @deprecated Writes the retired `# Nutritional Information (Per 100g)` body
 * section. The breakdown now lives in frontmatter, built by `nutrientListValue`
 * from a `MealNutritionPer100g`. No caller left: the editor stopped calling it
 * when the breakdown moved, and it is kept as the reader's specification rather
 * than for anything to use.
 */
export function renderNutritionSection(values: Per100gNutrition): string {
  return [
    line('Calories', values.calories, ' kcal'),
    line('Energy', values.kj, ' kJ'),
    line('Protein (g)', values.protein, 'g'),
    line('Fat (g)', values.fat, 'g'),
    line('Carbohydrates (g)', values.carbs, 'g'),
  ].join('\n');
}

/**
 * @deprecated Writes the retired `# Micronutrient Information (Per 100g)`
 * section, under a `Sodium` label that never held sodium. The breakdown now
 * lives in frontmatter, built by `nutrientListValue` from a
 * `MealNutritionPer100g`. No caller left, for the same reason as the renderer
 * above, and kept for the same one: it is what wrote the label the reader has to
 * go on reading, mislabelled row included.
 */
export function renderMicronutrientSection(values: Per100gNutrition): string {
  return [
    line('Sodium', values.salt, 'g'),
    line('Sugar', values.sugar, 'g'),
    line('Saturated Fat', values.saturatedFat, 'g'),
  ].join('\n');
}

/**
 * Which of the old fields a section actually mentioned.
 *
 * `parseNutritionSection` cannot answer this: a line that is absent and a line
 * that is present with nothing after the colon both read back as null, and the
 * old writer emitted `- **Sodium:** ` on purpose, as a row somebody could fill
 * in later. That blank row is a statement, so the bridge keeps it as an entry
 * with a null value, and only a nutrient the section never named is left out.
 */
function statedFields(markdown: string): Set<string> {
  return new Set(readFields(markdown).keys());
}

function stated(fields: Set<string>, labels: readonly string[]): boolean {
  return labels.some((label) => fields.has(label));
}

/**
 * The old body sections, read into the model that replaces them.
 *
 * The bridge for the migration, and for every note nobody has migrated yet. Two
 * things are corrected on the way through, both of them mistakes in the old
 * format rather than choices being revisited:
 *
 * **`Sodium` means salt.** The field was named `salt` internally from the start;
 * the label, the English string and the German `Natrium` were all wrong about
 * what sits under them. The figures in the vault run 0.5 to 1.3 per 100 g, which
 * is salt in grams and is not sodium in any unit. Nothing is converted or
 * multiplied here: this is a relabelling of a number that was always right.
 * Outside this function, where the mistake is known to be a mistake, `Sodium`
 * matches `sodium`, because that is what the word means.
 *
 * **Sugar and saturated fat are macronutrients.** They sat under
 * `# Micronutrient Information` because that heading had become "the second
 * section" rather than a category. Sugars and saturates are declared as parts of
 * the carbohydrate and fat lines on every label in the EU, and putting them back
 * among the macros is what makes the order this package sorts into mean anything.
 *
 * Units are the default for each id, which for all six of these is `g`, exactly
 * what the old writer emitted. Nothing is lost by not reading them back off the
 * line: that writer had no way to produce anything else.
 */
export function parseLegacyPer100gSections(
  nutritionSection: string,
  micronutrientSection: string
): MealNutritionPer100g {
  const values = parsePer100g(nutritionSection, micronutrientSection);
  const fields = new Set([
    ...statedFields(nutritionSection),
    ...statedFields(micronutrientSection),
  ]);

  const entry = (id: string, value: number | null): NutrientEntry => ({
    name: id,
    unit: defaultUnitFor(id),
    value,
  });

  const macronutrients: NutrientEntry[] = [];
  if (stated(fields, LEGACY_LABELS.fat)) macronutrients.push(entry('fat', values.fat));
  if (stated(fields, LEGACY_LABELS.saturatedFat)) {
    macronutrients.push(entry('saturatedFat', values.saturatedFat));
  }
  if (stated(fields, LEGACY_LABELS.carbs)) macronutrients.push(entry('carbs', values.carbs));
  if (stated(fields, LEGACY_LABELS.sugar)) macronutrients.push(entry('sugar', values.sugar));
  if (stated(fields, LEGACY_LABELS.protein)) macronutrients.push(entry('protein', values.protein));

  const micronutrients: NutrientEntry[] = [];
  if (stated(fields, LEGACY_LABELS.salt)) micronutrients.push(entry('salt', values.salt));

  return {
    caloriesPer100g: values.calories,
    kjPer100g: values.kj,
    macronutrients: inNutrientOrder(macronutrients),
    micronutrients: inNutrientOrder(micronutrients),
  };
}
