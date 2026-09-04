/**
 * Everything the meal-plan view does to a plan.
 *
 * Plain functions rather than a manager object. Each one takes the app and
 * the settings, writes the note first and updates state second, and returns
 * whether anything changed so the caller knows whether to save and re-render.
 *
 * Note first, always. A crash between the two leaves the note right and state
 * stale, which the next sync repairs; the other order leaves state claiming a
 * meal the note never held, which nothing repairs.
 */
import { App } from 'obsidian';
import { localDateISO } from 'trail-core';
import type { CULItrailSettings, MealPlanEntry } from '../../settings/types';
import { entriesInScope, type EntryScope } from './entries';
import { newEntryId } from './sync';
import {
  insertMealPlanEntry,
  removeMealPlanEntries,
  removeMealPlanEntry,
  updateMealPlanEntryFields,
} from './write';

export interface NewEntry {
  /** A meal path, or '' for a meal named directly. */
  mealPath: string;
  label?: string;
  day?: string;
  meal?: string;
  isLeftovers?: boolean;
}

/** Adds one meal to a week, writing the note line. */
export async function addEntry(
  app: App,
  settings: CULItrailSettings,
  scope: EntryScope,
  spec: NewEntry
): Promise<MealPlanEntry | null> {
  const entry: MealPlanEntry = {
    id: newEntryId(),
    mealPath: spec.mealPath,
    label: spec.mealPath ? undefined : spec.label,
    day: spec.day,
    meal: spec.meal,
    person: scope.person,
    week: scope.week,
    isLeftovers: spec.isLeftovers || undefined,
    addedDate: localDateISO(),
  };

  if (!(await insertMealPlanEntry(app, settings, entry))) return null;

  settings.state.mealPlan.push(entry);
  return entry;
}

function find(settings: CULItrailSettings, id: string): MealPlanEntry | undefined {
  return settings.state.mealPlan.find((entry) => entry.id === id);
}

/** Removes one meal. */
export async function removeEntry(
  app: App,
  settings: CULItrailSettings,
  id: string
): Promise<boolean> {
  const entry = find(settings, id);
  if (!entry) return false;

  await removeMealPlanEntry(app, settings, entry);

  settings.state.mealPlan = settings.state.mealPlan.filter((candidate) => candidate.id !== id);
  return true;
}

/**
 * Applies a change to one entry.
 *
 * One write, whatever changed, including the day. That is new: while the note
 * was a checklist a day change meant moving a line between two `##` sections,
 * so it had to be a remove followed by an insert, and the card dropped to the
 * bottom of its new day. An entry's day is now a field like any other.
 */
async function update(
  app: App,
  settings: CULItrailSettings,
  id: string,
  changes: Partial<
    Pick<MealPlanEntry, 'day' | 'meal' | 'rating' | 'isLeftovers' | 'label' | 'eaten'>
  >
): Promise<boolean> {
  const entry = find(settings, id);
  if (!entry) return false;

  const after = { ...entry, ...changes };
  if (JSON.stringify(entry) === JSON.stringify(after)) return false;

  // The note first, and from the state entry as it will be rather than as it
  // was: a failed write leaves state stale, which the next sync repairs, where
  // the other order leaves the note claiming something nothing repairs.
  await updateMealPlanEntryFields(app, settings, entry, after);
  Object.assign(entry, changes);

  return true;
}

/** Moves a meal to another day, or to the queue when `day` is undefined. */
export function rescheduleEntry(
  app: App,
  settings: CULItrailSettings,
  id: string,
  day: string | undefined
): Promise<boolean> {
  return update(app, settings, id, { day });
}

export function setEntrySlot(
  app: App,
  settings: CULItrailSettings,
  id: string,
  meal: string | undefined
): Promise<boolean> {
  return update(app, settings, id, { meal });
}

export function setEntryRating(
  app: App,
  settings: CULItrailSettings,
  id: string,
  rating: number | undefined
): Promise<boolean> {
  return update(app, settings, id, { rating });
}

export function setEntryLeftovers(
  app: App,
  settings: CULItrailSettings,
  id: string,
  isLeftovers: boolean
): Promise<boolean> {
  return update(app, settings, id, { isLeftovers: isLeftovers || undefined });
}

/**
 * Marks a meal eaten, or plans it again.
 *
 * The write this exists for is not this one. Recording a cook has to end in a
 * ticked plan line, and until now nothing in the plugin could produce one:
 * the model had no such field and the renderer wrote `- [ ]` whatever it was
 * given. This is that path, with a menu item on top of it so the state is
 * reachable rather than only inferable.
 */
export function setEntryEaten(
  app: App,
  settings: CULItrailSettings,
  id: string,
  eaten: boolean
): Promise<boolean> {
  return update(app, settings, id, { eaten: eaten || undefined });
}

/** Empties one person's week. */
export async function clearWeek(
  app: App,
  settings: CULItrailSettings,
  scope: EntryScope
): Promise<number> {
  const entries = entriesInScope(settings.state.mealPlan, scope);
  if (entries.length === 0) return 0;

  // One write rather than one per entry, which is also what makes it atomic:
  // a week half-cleared is a week somebody has to finish clearing by hand.
  await removeMealPlanEntries(app, settings, entries);

  const cleared = new Set(entries.map((entry) => entry.id));
  settings.state.mealPlan = settings.state.mealPlan.filter((entry) => !cleared.has(entry.id));
  return entries.length;
}
