/**
 * Saving the editor's draft back into the note.
 *
 * Frontmatter first through `processFrontMatter`, then the body. Each write
 * touches exactly its own span, so a note keeps every section CULItrail has no
 * feature for, and its own formatting, through a save.
 *
 * A property already in the note is rewritten under **its own spelling**, not
 * the configured one. A vault carrying `prep:` where the setting says
 * `prepTime` would otherwise come back with both, one of them orphaned. That
 * applies to the nutrition figures as much as to the timings: a note keyed
 * `kcal:` gets its calories written back into `kcal:`.
 */
import { App, TFile } from 'obsidian';
import { nutrientListValue, stampModified, wikilinkValue } from '@technosoftware/trail-core';
import type { CULItrailSettings } from '../../settings/types';
import { nutrientFieldNames } from '../nutrient-fields';
import { mealMetaAliases } from '../parser/meal-meta';
import { removeSection, replaceDescription } from './body-edit';
import { deriveServingNutrition } from './per-serving';
import type { MealDraft } from './types';

/** The key this note already uses for a field, or the configured one. */
function existingKey(
  frontmatter: Record<string, unknown>,
  aliases: string[],
  fallback: string
): string {
  const byLowercase = new Map(Object.keys(frontmatter).map((key) => [key.toLowerCase(), key]));
  for (const alias of aliases) {
    const found = byLowercase.get(alias.toLowerCase());
    if (found !== undefined) return found;
  }
  return fallback;
}

function writeNumber(
  frontmatter: Record<string, unknown>,
  aliases: string[],
  fallback: string,
  value: number | null
): void {
  frontmatter[existingKey(frontmatter, aliases, fallback)] = value;
}

function writeFrontmatter(
  frontmatter: Record<string, unknown>,
  draft: MealDraft,
  settings: CULItrailSettings
): void {
  const aliases = mealMetaAliases(settings);

  writeNumber(frontmatter, aliases.prepTime, settings.prepTimeProperty, draft.prepTime);
  writeNumber(frontmatter, aliases.reheatTime, settings.reheatTimeProperty, draft.reheatTime);
  writeNumber(frontmatter, aliases.totalTime, settings.totalTimeProperty, draft.totalTime);
  frontmatter[settings.servingsProperty] = draft.servings;
  // Through `writeNumber` rather than assigned, so clearing the field removes the
  // property instead of leaving `price: null` on every meal nobody buys.
  writeNumber(frontmatter, aliases.price, settings.priceProperty, draft.price);

  // Written back as a wikilink, and removed rather than emptied when cleared: a
  // `supplier:` with nothing after it is a property the reheating resolver would
  // read as a supplier named "".
  if (draft.supplier) {
    frontmatter[settings.supplierProperty] = wikilinkValue(draft.supplier);
  } else {
    delete frontmatter[settings.supplierProperty];
  }

  // Cleared rather than emptied, for the same reason the supplier is: an empty
  // `line:` would read as a range with no name, and an empty `priceCurrency:`
  // would win the currency chain over the supplier's real one.
  const line = draft.line?.trim();
  if (line) frontmatter[settings.mealLineProperty] = line;
  else delete frontmatter[settings.mealLineProperty];

  const priceCurrency = draft.priceCurrency?.trim();
  if (priceCurrency) frontmatter[settings.mealPriceCurrencyProperty] = priceCurrency;
  else delete frontmatter[settings.mealPriceCurrencyProperty];

  // Written to the configured property only. A note that carried its picture
  // under an alias such as `cover` keeps that property untouched and gains
  // nothing here unless somebody changes the field, which is the conservative
  // half of reading aliases: read widely, write one place.
  const image = draft.image.trim();
  if (image) frontmatter[settings.imageProperty] = image;
  else delete frontmatter[settings.imageProperty];

  // A blank field means the property should go, not that it should be an
  // empty string: an empty `diet:` renders as a badge with no value.
  const diet = draft.diet.trim();
  if (diet) frontmatter[settings.dietProperty] = diet;
  else delete frontmatter[settings.dietProperty];

  const allergens = draft.allergens
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (allergens.length > 0) frontmatter[settings.allergensProperty] = allergens;
  else delete frontmatter[settings.allergensProperty];

  writeNutrition(frontmatter, draft, settings);
}

/**
 * What the label says about 100 g of this meal: two energy figures and two
 * lists, one entry per nutrient.
 *
 * Assigned inside the same `processFrontMatter` pass as everything else so
 * Obsidian serializes it with its own writer. Nothing here builds YAML: a block
 * written by hand changes shape the first time anything else edits the note.
 *
 * An empty list is deleted rather than written as `[]`, the same rule the diet
 * and the product line follow. A meal that names no micronutrient has not
 * stated an empty set of them, and a property holding nothing reads as a label
 * that declared nothing where the truth is that nobody has typed it in yet.
 *
 * The entries go in as the draft holds them, deliberately unsorted. The form
 * can reorder a list, and a writer that sorted on the way past would quietly
 * undo that every time.
 */
function writePer100g(
  frontmatter: Record<string, unknown>,
  draft: MealDraft,
  settings: CULItrailSettings
): void {
  const fields = nutrientFieldNames(settings);

  // A blank property name means the vault asked for that figure to go nowhere,
  // the same rule `kjProperty` below already follows. Writing it anyway would
  // put a key with no name into somebody's frontmatter.
  const energy = [
    { property: settings.caloriesPer100gProperty, value: draft.per100g.caloriesPer100g },
    { property: settings.kjPer100gProperty, value: draft.per100g.kjPer100g },
  ];

  for (const figure of energy) {
    if (!figure.property) continue;
    writeNumber(frontmatter, [figure.property], figure.property, figure.value);
  }

  const lists = [
    { property: settings.macronutrientsProperty, entries: draft.per100g.macronutrients },
    { property: settings.micronutrientsProperty, entries: draft.per100g.micronutrients },
  ];

  for (const list of lists) {
    if (!list.property) continue;

    const key = existingKey(frontmatter, [list.property], list.property);
    const records = nutrientListValue(list.entries, fields);
    if (records.length > 0) frontmatter[key] = records;
    else delete frontmatter[key];
  }
}

/**
 * The per-serving figures.
 *
 * With a per-100 g breakdown they are computed from it and the serving
 * weight, which is what makes the label and the frontmatter agree after any
 * edit to either. Without one they are whatever was typed, and nothing is
 * derived: a meal that only ever stated per-serving numbers has no
 * breakdown to compute from, and inventing a serving weight to get one would
 * produce figures that look measured.
 *
 * **A breakdown with no serving weight derives nothing.** This used to read
 * `draft.servingGrams ?? 0` and then multiply, so a meal carrying a full label
 * and no weight wrote `calories: 0` into its own frontmatter, which is a claim
 * that a portion of it contains no energy. `deriveServingNutrition` returns null
 * for all five figures instead, and a null is written as a property with nothing
 * after it: unknown, which is exactly what it is.
 *
 * Every figure goes through `writeNumber`, so a note that keys its calories
 * `kcal:` gets them back under `kcal:`. Assigning `settings.caloriesProperty`
 * directly, as this did, gave such a note a second key and orphaned the first,
 * which is the failure the alias resolution at the top of this file exists to
 * prevent.
 */
function writeNutrition(
  frontmatter: Record<string, unknown>,
  draft: MealDraft,
  settings: CULItrailSettings
): void {
  const aliases = mealMetaAliases(settings);

  if (!draft.hasPer100g) {
    writeNumber(frontmatter, aliases.calories, settings.caloriesProperty, draft.totals.calories);
    writeNumber(frontmatter, aliases.protein, settings.proteinProperty, draft.totals.protein);
    writeNumber(frontmatter, aliases.fat, settings.fatProperty, draft.totals.fat);
    writeNumber(frontmatter, aliases.carbs, settings.carbsProperty, draft.totals.carbs);
    return;
  }

  writePer100g(frontmatter, draft, settings);

  const serving = deriveServingNutrition(draft.per100g, draft.servingGrams);
  writeNumber(frontmatter, aliases.calories, settings.caloriesProperty, serving.calories);
  writeNumber(frontmatter, aliases.protein, settings.proteinProperty, serving.protein);
  writeNumber(frontmatter, aliases.fat, settings.fatProperty, serving.fat);
  writeNumber(frontmatter, aliases.carbs, settings.carbsProperty, serving.carbs);

  if (settings.kjProperty) {
    writeNumber(frontmatter, [settings.kjProperty], settings.kjProperty, serving.kj);
  }
  // One weight, written once. A second property beside this one held the same
  // `draft.servingGrams` under a different name, so it could never say anything
  // `serving_size` did not, and nothing ever read it back. Two names for one
  // number is not redundancy that protects anything; it is a second place for a
  // reader to look and a second thing for a hand edit to contradict.
  if (draft.servingGrams !== null && settings.servingSizeProperty) {
    frontmatter[settings.servingSizeProperty] = `${draft.servingGrams}g`;
  }
}

export async function writeMealDraft(
  app: App,
  file: TFile,
  settings: CULItrailSettings,
  draft: MealDraft
): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
    writeFrontmatter(frontmatter, draft, settings);
    // A save is one edit however many passes it takes, so `modified` is
    // stamped here and nowhere else in this function. Stamping per pass would
    // write several different times into one note for one click.
    stampModified(frontmatter, settings);
  });

  // A named edit rather than a rewrite of the whole body, so every section this
  // plugin has no feature for comes through the save untouched.
  await app.vault.process(file, (contents) => replaceDescription(contents, draft.description));

  if (!draft.hasPer100g) return;

  // The figures are in the frontmatter now, so the two sections that used to
  // hold them come out. Without this a converted meal would carry the same label
  // twice, in two places that drift apart the moment somebody edits one of them.
  //
  // One pass for both, unlike the description above, because this is one edit
  // and not two: removing a section a note has not got is a no-op, so there is
  // no half-done state for a failure between the two to leave behind.
  await app.vault.process(file, (contents) =>
    removeSection(removeSection(contents, settings.nutritionHeading), settings.micronutrientHeading)
  );
}
