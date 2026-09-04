/**
 * The note shown above a meal: the reader's own allergens, found in what the
 * note declares.
 *
 * Opt-in, and phrased as information rather than as a verdict. A plugin that
 * told somebody their dinner was unsafe on the strength of a keyword match
 * would be wrong often enough to be ignored always.
 *
 * App-free.
 */
import type { CULItrailSettings } from '../../settings/types';

export interface AllergenWarning {
  kind: 'allergen';
  /** The reader's own allergen terms that matched, not the meal's declared list. */
  matched: string[];
}

export type MealWarning = AllergenWarning;

/**
 * The reader's allergens found among a meal's declared allergen list.
 *
 * A substring match rather than an equality one, because a household writes
 * `nuts` in its settings and a company writes `tree nuts` on the label.
 */
export function allergenWarning(declared: string[], myAllergens: string[]): AllergenWarning | null {
  const haystack = declared.map((entry) => entry.toLowerCase());

  const matched = myAllergens
    .map((allergen) => allergen.trim().toLowerCase())
    .filter((allergen) => allergen !== '')
    .filter((allergen) => haystack.some((entry) => entry.includes(allergen)));

  return matched.length > 0 ? { kind: 'allergen', matched: [...new Set(matched)] } : null;
}

export function buildWarnings(
  declaredAllergens: string[],
  settings: CULItrailSettings
): MealWarning[] {
  const allergens = allergenWarning(declaredAllergens, settings.myAllergens);
  return allergens ? [allergens] : [];
}
