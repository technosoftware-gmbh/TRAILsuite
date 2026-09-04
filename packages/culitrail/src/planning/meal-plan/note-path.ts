/**
 * Which file a meal-plan entry belongs in.
 *
 * One note per person per ISO week, so the path depends on the entry itself
 * rather than on what the view currently has open. That is the whole point:
 * a background resync, or a callback that fires after somebody has switched
 * person or week, must not write into the wrong file.
 *
 * App-free.
 */
import { startOfWeekTitle } from 'trail-core';
import { resolveNotePath, templateNeedsPerson } from '../../shared/note-path';
import type { CULItrailSettings, MealPlanEntry } from '../../settings/types';

/** The note holding one person's plan for one week. */
export function mealPlanNotePath(
  settings: CULItrailSettings,
  week: string,
  person: string
): string | null {
  const date = startOfWeekTitle(week);
  // A week title that does not parse means a caller has invented one. Better
  // no path than a note filed under whatever today happens to be.
  if (!date) return null;

  // A per-person template with nobody to fill in resolves to a path with a
  // literal `{person}` in it, which is a file nobody meant to create.
  if (templateNeedsPerson(settings.mealPlanPath) && !person.trim()) return null;

  return resolveNotePath(settings.mealPlanPath, { date, person });
}

/** The note one entry belongs in, keyed off the entry rather than the current view. */
export function pathForEntry(settings: CULItrailSettings, entry: MealPlanEntry): string | null {
  if (!entry.week) return null;
  return mealPlanNotePath(settings, entry.week, entry.person ?? '');
}
