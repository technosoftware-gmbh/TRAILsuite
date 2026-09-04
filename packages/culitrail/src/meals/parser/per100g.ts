/**
 * A meal note's per-100 g breakdown, from wherever that note keeps it.
 *
 * Two readers need the same answer to the same question and have no business
 * answering it twice: the editor, which loads a note into a draft, and the meal
 * view, which shows what the note says. Both have to look in frontmatter first
 * and fall back to the two retired body sections, and a second copy of that
 * rule would drift the moment one of them learned something the other did not.
 * A view showing a figure the editor cannot see is the worst version of that
 * drift, because the next save writes the note without it.
 *
 * **Frontmatter first, then the sections, whole-model rather than field by
 * field.** A note states its breakdown in one place or the other. Merging the
 * two would let a stale section overwrite a figure somebody had already
 * corrected in the frontmatter, which is exactly the state a half-migrated
 * vault is in. `isEmptyMealNutrition` counts a row with no figure as something
 * stated, so a note whose only frontmatter nutrition is a named-but-unmeasured
 * salt row reads from frontmatter and not from its old sections.
 *
 * **The four properties are read under their configured names only, with no
 * alias list**, which is where this deliberately departs from `meal-meta.ts`
 * next door. An alias is a way of finding a figure a *writer* would not
 * produce, and the writer for these four is `write-draft.ts`, which resolves
 * exactly one name each. A view that read `kcal_100g` as well would show a
 * figure the editor never sees and orphan it on the next save, which is the
 * bug phase 3 removed from the per-serving writes rather than one to add here.
 *
 * The two body sections are read only. Nothing writes them any more; a heading
 * is simply the only thing that can find the figures in a meal written before
 * the move, and every meal in the vault this was built against is such a meal
 * until the migration runs. `parseLegacyPer100gSections` corrects the old
 * `Sodium` label, which never held sodium, on the way through.
 *
 * App-free.
 */
import {
  isEmptyMealNutrition,
  parseLegacyPer100gSections,
  readNumberLike,
  readNutrientList,
  type MealNutritionPer100g,
} from 'trail-core';
import type { CULItrailSettings } from '../../settings/types';
import { nutrientFieldNames } from '../nutrient-fields';
import { extractSection } from './body-sections';

/**
 * What the note says about 100 g of itself, and where that came from.
 *
 * The editor needs both flags and the view needs neither. `legacy` is not
 * "the figures below came from a section": it says the note still carries one,
 * whatever it holds, which is what decides whether saving has a conversion to
 * do. `stated` says the frontmatter won.
 */
export interface Per100gReading {
  per100g: MealNutritionPer100g;
  /** The frontmatter states something, so it wins outright. */
  stated: boolean;
  /** At least one of the two retired sections is present, whatever is under it. */
  legacy: boolean;
}

/** The breakdown a note's frontmatter states, empty when it states none. */
export function readPer100gProperties(
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings
): MealNutritionPer100g {
  const fields = nutrientFieldNames(settings);
  return {
    caloriesPer100g: readNumberLike(frontmatter[settings.caloriesPer100gProperty]),
    kjPer100g: readNumberLike(frontmatter[settings.kjPer100gProperty]),
    macronutrients: readNutrientList(frontmatter[settings.macronutrientsProperty], fields),
    micronutrients: readNutrientList(frontmatter[settings.micronutrientsProperty], fields),
  };
}

/**
 * The breakdown, and which of the two places it came from.
 *
 * `body` is the note's lines with the frontmatter already off. A caller with no
 * body to offer passes none and gets the frontmatter half, which is the honest
 * answer rather than a degraded one: the gallery and the suggester read the
 * metadata cache and have not opened the file, so a legacy section is something
 * they genuinely cannot see.
 */
export function readPer100g(
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings,
  body: string[] = []
): Per100gReading {
  const stated = readPer100gProperties(frontmatter, settings);
  const nutrition = extractSection(body, settings.nutritionHeading);
  const micronutrients = extractSection(body, settings.micronutrientHeading);
  const legacy = nutrition.exists || micronutrients.exists;

  if (!isEmptyMealNutrition(stated)) return { per100g: stated, stated: true, legacy };

  return {
    per100g: parseLegacyPer100gSections(nutrition.content, micronutrients.content),
    stated: false,
    legacy,
  };
}
