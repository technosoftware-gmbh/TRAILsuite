/**
 * Eating history, read from the meal plans.
 *
 * The plan note has been the single store since the August 2026 migration, and
 * this is the reader that makes that true for CULItrail. Until it existed,
 * three things here read a log that no longer exists: the meal view's history
 * panel, the dashboard's activity chart and the eating-streak badge all went to
 * `eatingHistory` in a meal's frontmatter, and the migration took that property
 * off all 126 meals. They did not break; they went quiet, which is worse.
 *
 * **An eaten entry is a meal eaten.** That is the whole definition, and it is
 * now a real `eaten: true` rather than a ticked checkbox. A planned entry
 * contributes nothing.
 *
 * One pass over the plan notes, not one per meal. 119 notes hold 444 events in
 * the vault this was written against, and asking the question once and keying
 * the answer by meal is the difference between that and 126 passes.
 */
import { App } from 'obsidian';
import { datesOfWeek } from 'trail-core';
import { WEEKDAY_KEYS } from '../../lang/vocabulary';
import type { CULItrailSettings } from '../../settings/types';
import type { EatingEntry } from '../../meals/types';
import { readAllPlanNotes } from './read-plans';

export { mealPlanFolder } from './read-plans';

/**
 * Every meal the plans record as eaten, keyed by the meal note's path.
 *
 * A wikilink that resolves to nothing is skipped rather than kept under its
 * text: the caller wants a meal's history, and a link to a note that is not
 * there is not that meal's anything.
 */
export async function readEatingEvents(
  app: App,
  settings: CULItrailSettings
): Promise<Map<string, EatingEntry[]>> {
  const byMeal = new Map<string, EatingEntry[]>();

  for (const plan of await readAllPlanNotes(app, settings)) {
    if (!plan.week) continue;

    // Monday-first, which is the order both WEEKDAY_KEYS and the ISO week the
    // paths are keyed on use. A note whose week does not parse gives no dates
    // and contributes nothing rather than dates from some other week.
    const dates = datesOfWeek(plan.week);
    if (dates.length !== WEEKDAY_KEYS.length) continue;

    for (const entry of plan.entries) {
      if (!entry.eaten || !entry.mealTitle || !entry.day) continue;

      const date = dates[WEEKDAY_KEYS.indexOf(entry.day)];
      if (!date) continue;

      const meal = app.metadataCache.getFirstLinkpathDest(entry.mealTitle, plan.file.path);
      if (!meal) continue;

      const events = byMeal.get(meal.path) ?? [];
      events.push({
        date,
        time: entry.time,
        // Null on an eaten entry is eaten and deliberately unrated, which is
        // what the old format wrote `[rating:: 0]` for.
        rating: entry.rating,
        note: entry.note,
        person: plan.personTitle,
        id: entry.id || null,
      });
      byMeal.set(meal.path, events);
    }
  }

  // Newest first, which is the order every consumer of a log renders it in.
  for (const events of byMeal.values()) {
    events.sort((a, b) => b.date.localeCompare(a.date));
  }

  return byMeal;
}

/** One meal's history. For the meal view, which opens one note at a time. */
export async function readEatingEventsFor(
  app: App,
  settings: CULItrailSettings,
  mealPath: string
): Promise<EatingEntry[]> {
  return (await readEatingEvents(app, settings)).get(mealPath) ?? [];
}
