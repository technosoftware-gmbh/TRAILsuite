/**
 * Writing one meal-plan entry into, or out of, its note.
 *
 * The note is the source of truth, so an add is a note edit first and a state
 * change second. State follows on the next sync, or is updated by the caller
 * alongside this; it is never the thing that made the change.
 *
 * What is left here is the translation between the two vocabularies: state
 * holds a `MealPlanEntry` keyed by meal *path*, and the note holds a
 * `PlanEntryContent` naming a meal by *title*, because that is what a wikilink
 * resolves against. The writing itself is `write-plan.ts`.
 */
import { App, TFile } from 'obsidian';
import { parseMealSlotKey, parseWeekdayKey } from '../../lang/vocabulary';
import type { CULItrailSettings, MealPlanEntry } from '../../settings/types';
import { pathForEntry } from './note-path';
import { emptyPlanEntry, type PlanEntryContent } from './plan-note';
import { readPlanFor } from './read-plans';
import { patchPlanEntry, removePlanEntries, upsertPlanEntry, type PlanContext } from './write-plan';

/** The meal's note title, which is what a wikilink resolves against. */
function mealTitle(app: App, mealPath: string): string {
  const file = app.vault.getFileByPath(mealPath);
  if (file instanceof TFile) return file.basename;

  // A path with no file behind it still has a usable title in it. Better a
  // link that resolves to nothing than an entry with no name at all.
  return mealPath.split('/').pop()?.replace(/\.md$/, '') ?? mealPath;
}

/** Which week and whose, as the note should state it. */
function contextFor(entry: MealPlanEntry): PlanContext {
  return { week: entry.week ?? null, personTitle: entry.person || null };
}

/** The note's view of a state entry. Fields the note owns and state does not are left to the merge. */
function contentFor(app: App, entry: MealPlanEntry): PlanEntryContent {
  return {
    ...emptyPlanEntry(entry.id),
    mealTitle: entry.mealPath ? mealTitle(app, entry.mealPath) : null,
    label: entry.mealPath ? null : entry.label?.trim() || null,
    day: parseWeekdayKey(entry.day ?? ''),
    slot: parseMealSlotKey(entry.meal),
    eaten: entry.eaten === true,
    rating: entry.rating && entry.rating >= 1 && entry.rating <= 5 ? entry.rating : null,
    isLeftovers: entry.isLeftovers === true,
  };
}

export async function insertMealPlanEntry(
  app: App,
  settings: CULItrailSettings,
  entry: MealPlanEntry
): Promise<boolean> {
  const path = pathForEntry(settings, entry);
  if (!path) return false;

  return upsertPlanEntry(app, settings, path, contextFor(entry), contentFor(app, entry));
}

/** Removes one entry from its note, by id. */
export async function removeMealPlanEntry(
  app: App,
  settings: CULItrailSettings,
  entry: MealPlanEntry
): Promise<boolean> {
  const path = pathForEntry(settings, entry);
  if (!path) return false;

  return removePlanEntries(app, settings, path, contextFor(entry), [contentFor(app, entry)]);
}

/** Removes several entries from one note in a single write. For clearing a week. */
export async function removeMealPlanEntries(
  app: App,
  settings: CULItrailSettings,
  entries: readonly MealPlanEntry[]
): Promise<boolean> {
  const first = entries[0];
  if (!first) return false;

  const path = pathForEntry(settings, first);
  if (!path) return false;

  return removePlanEntries(
    app,
    settings,
    path,
    contextFor(first),
    entries.map((entry) => contentFor(app, entry))
  );
}

/**
 * Changes one entry's fields in place.
 *
 * The fields state knows about, and only those. An entry's `time:` and `note:`
 * belong to whoever recorded eating it, and a rating change must not be the
 * thing that deletes them, which is why this patches rather than rewrites. The
 * defect that rule comes from is real: the line-based version of this looked
 * for the rendered form of an entry and rewrote the whole line with it, and
 * once the vault's lines were ticked and some carried a `[note:: …]`, it
 * matched nothing and turned every rating into a silent no-op.
 */
export async function updateMealPlanEntryFields(
  app: App,
  settings: CULItrailSettings,
  before: MealPlanEntry,
  after: MealPlanEntry
): Promise<boolean> {
  const path = pathForEntry(settings, after);
  if (!path) return false;

  // The entry as the note has it now is what finds it; the entry as it will be
  // is what gets written. Handing the second one to the lookup as well would
  // make a day change look for a card already sitting on the new day.
  const content = contentFor(app, after);
  return patchPlanEntry(app, settings, path, contextFor(after), contentFor(app, before), {
    mealTitle: content.mealTitle,
    label: content.label,
    day: content.day,
    slot: content.slot,
    eaten: content.eaten,
    rating: content.rating,
    isLeftovers: content.isLeftovers,
  });
}

/** How many entries a note currently holds. For a caller deciding whether a week has anything in it. */
export async function countMealPlanEntries(
  app: App,
  settings: CULItrailSettings,
  path: string
): Promise<number> {
  return (await readPlanFor(app, settings, path))?.entries.length ?? 0;
}
