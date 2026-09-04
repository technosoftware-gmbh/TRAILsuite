/**
 * Selecting entries out of the one flat list `settings.state.mealPlan` holds.
 *
 * That list carries every week and every person at once, because it is a
 * mirror of many notes rather than of one. Almost nothing wants all of it, so
 * every consumer narrows through here rather than writing its own filter and
 * quietly disagreeing about what "this week" means.
 *
 * App-free.
 */
import type { MealPlanEntry } from '../../settings/types';

export interface EntryScope {
  week: string;
  /** The Person note title. An empty string means a vault with no people configured. */
  person: string;
}

/**
 * True when an entry belongs to a given week and person.
 *
 * An exact match on both, with no fallback for a missing `week`. The
 * inherited version treats an absent week as "the current week" to
 * accommodate entries written before week navigation existed; CULItrail has
 * never written one, so adopting that rule would mean carrying a migration
 * for data that cannot exist and silently pulling untagged junk into
 * whichever week happened to be on screen.
 */
export function entryInScope(entry: MealPlanEntry, scope: EntryScope): boolean {
  return entry.week === scope.week && (entry.person ?? '') === scope.person;
}

export function entriesInScope(entries: MealPlanEntry[], scope: EntryScope): MealPlanEntry[] {
  return entries.filter((entry) => entryInScope(entry, scope));
}

/** Entries for one meal, whatever week or person they belong to. For the meal view's "in the plan" state. */
export function entriesForMeal(entries: MealPlanEntry[], mealPath: string): MealPlanEntry[] {
  return entries.filter((entry) => entry.mealPath === mealPath);
}

/**
 * Entries grouped by weekday key, with the queue under `null`.
 *
 * A Map rather than an object so the queue can key off `null` without
 * becoming the string `'null'`, which is what an object would turn it into
 * and which would then be indistinguishable from a weekday nobody recognises.
 */
export function groupByDay(entries: MealPlanEntry[]): Map<string | null, MealPlanEntry[]> {
  const grouped = new Map<string | null, MealPlanEntry[]>();
  for (const entry of entries) {
    const day = entry.day ?? null;
    const group = grouped.get(day) ?? [];
    group.push(entry);
    grouped.set(day, group);
  }
  return grouped;
}
