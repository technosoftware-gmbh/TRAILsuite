/**
 * Matching a meal's allergens against the reader's own list.
 *
 * Substring matching in both directions, because the two lists are written by
 * different people. A meal says `tree nuts`, a reader writes `nuts`, and
 * a match that only worked on exact equality would quietly fail to warn.
 * Over-warning is the safer failure here by a long way.
 *
 * App-free.
 */

/** Every allergen of a meal that appears in the reader's list. */
export function matchingAllergens(mealAllergens: string[], mine: string[]): string[] {
  const wanted = mine.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry !== '');
  if (wanted.length === 0) return [];

  return mealAllergens.filter((allergen) => {
    const candidate = allergen.trim().toLowerCase();
    if (!candidate) return false;
    return wanted.some((entry) => candidate.includes(entry) || entry.includes(candidate));
  });
}
