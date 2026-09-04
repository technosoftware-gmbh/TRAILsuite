/**
 * Building the editor's draft from a note.
 *
 * Reads the file's text as well as its metadata cache, because the description
 * sits in the body and so does the per-100 g breakdown of every meal written
 * before it moved into frontmatter. `cachedRead` rather than `read`: this runs
 * when a modal opens, and the cache is the version Obsidian has already parsed
 * into the metadata the rest comes from.
 */
import { App, TFile } from 'obsidian';
import { findValue, linkOrText, readNumberLike, readString, readStringList } from 'trail-core';
import { frontmatterOf } from '../../shared/vault-scan';
import type { CULItrailSettings } from '../../settings/types';
import { extractLeadingText, stripFrontmatter } from '../parser/body-sections';
import { mealMetaAliases } from '../parser/meal-meta';
import { readPer100g } from '../parser/per100g';
import { readGrams } from '../parser/serving-size';
import type { MealDraft } from './types';

export async function readMealDraft(
  app: App,
  file: TFile,
  settings: CULItrailSettings
): Promise<MealDraft> {
  const frontmatter = frontmatterOf(app, file) ?? {};
  const aliases = mealMetaAliases(settings);
  const lines = stripFrontmatter(await app.vault.cachedRead(file)).split('\n');

  // The frontmatter first, then the two retired body sections as a fallback,
  // through the same reader the meal view uses. A note nobody has converted yet
  // keeps its figures under those headings, and reading them is also the whole
  // of the per-note migration: opening such a meal and saving it writes the
  // lists and takes the sections out.
  const breakdown = readPer100g(frontmatter, settings, lines);

  return {
    description: extractLeadingText(lines),
    prepTime: readNumberLike(findValue(frontmatter, ...aliases.prepTime)),
    reheatTime: readNumberLike(findValue(frontmatter, ...aliases.reheatTime)),
    totalTime: readNumberLike(findValue(frontmatter, ...aliases.totalTime)),
    servings: readNumberLike(findValue(frontmatter, ...aliases.servings)),
    price: readNumberLike(findValue(frontmatter, ...aliases.price)),
    // Stored as a wikilink, edited as a title. Resolved by title like every other
    // link in this plugin, so a company note that moved still matches.
    supplier: linkOrText(frontmatter[settings.supplierProperty]),
    line: readString(findValue(frontmatter, ...aliases.line)),
    priceCurrency: readString(findValue(frontmatter, ...aliases.priceCurrency)),
    // Kept exactly as the note wrote it, wikilink and all. The aliases matter
    // here: a vault that has been through another plugin often says `cover` or
    // `thumbnail`, and an editor that read only `image` would show an empty
    // field over a note that plainly has a picture, then save the emptiness.
    image: readString(findValue(frontmatter, ...aliases.image)) ?? '',
    diet: readStringList(findValue(frontmatter, ...aliases.diet)).join(', '),
    allergens: readStringList(findValue(frontmatter, ...aliases.allergens)).join(', '),
    // Either source is enough, and either section on its own is too. A note
    // carrying only the macros still keeps its figures per 100 g, and treating
    // it as per-serving would multiply the whole label by the serving weight on
    // the next save.
    hasPer100g: breakdown.stated || breakdown.legacy,
    per100g: breakdown.per100g,
    servingGrams: readGrams(frontmatter[settings.servingSizeProperty]),
    totals: {
      calories: readNumberLike(findValue(frontmatter, ...aliases.calories)),
      protein: readNumberLike(findValue(frontmatter, ...aliases.protein)),
      fat: readNumberLike(findValue(frontmatter, ...aliases.fat)),
      carbs: readNumberLike(findValue(frontmatter, ...aliases.carbs)),
    },
  };
}
