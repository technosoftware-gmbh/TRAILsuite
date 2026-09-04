/**
 * Recognising which configured badges are the three time badges.
 *
 * The mobile layout shows prep, cook and total in a fixed stat row of its own
 * rather than as chips, because they are the numbers somebody scans before
 * deciding to cook something. That only works if the badge row then leaves
 * them out: one classifier, used by both, so the stat row and the chips can
 * never disagree about which badge is which.
 *
 * It has to be a classifier rather than a list of ids because badges are user
 * configuration. Somebody can delete the built-in Prep badge and make their
 * own against the same property, and the stat row should still show it.
 *
 * App-free.
 */
import type { CULItrailSettings, CustomBadge } from '../../settings/types';
import { mealMetaAliases } from '../parser/meal-meta';

export type TimeBadgeKind = 'prep' | 'cook' | 'total';

function namesAny(property: string, aliases: string[]): boolean {
  const wanted = property.trim().toLowerCase();
  if (!wanted) return false;
  return aliases.some((alias) => alias.toLowerCase() === wanted);
}

/**
 * Which of the three time badges this is, or null.
 *
 * A total badge is recognised two ways. By property, which is the simple
 * case, and by formula: the shipped Total badge has no property of its own
 * and instead adds prep and cook together, so a formula naming both is a
 * total however it was written. That is a heuristic, and deliberately a
 * narrow one, since the cost of a false positive is only that a badge appears
 * in the stat row instead of the chip row.
 */
export function timeBadgeKind(
  badge: CustomBadge,
  settings: CULItrailSettings
): TimeBadgeKind | null {
  const aliases = mealMetaAliases(settings);

  if (namesAny(badge.property, aliases.prepTime)) return 'prep';
  if (namesAny(badge.property, aliases.reheatTime)) return 'cook';
  if (namesAny(badge.property, aliases.totalTime)) return 'total';

  if (badge.formula) {
    const formula = badge.formula.toLowerCase();
    const mentions = (names: string[]) =>
      names.some((name) => formula.includes(name.toLowerCase()));
    if (mentions(aliases.prepTime) && mentions(aliases.reheatTime)) return 'total';
  }

  return null;
}

/**
 * True for a badge the mobile layout renders somewhere other than the chip
 * row: the three times, which get the stat row, and last-made, which the
 * meal card above already shows.
 */
export function isMobileHandledElsewhere(badge: CustomBadge, settings: CULItrailSettings): boolean {
  if (timeBadgeKind(badge, settings) !== null) return true;
  return namesAny(badge.property, mealMetaAliases(settings).lastEaten);
}
