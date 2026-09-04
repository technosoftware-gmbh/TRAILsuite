/**
 * Reading the meal-plan notes for one week and making state agree with them.
 *
 * This is the only path that reconciles a week somebody is looking at, and it
 * makes state agree with the note, never the reverse. Everything decidable
 * lives in reconcile.ts; what remains here is vault reading, wikilink
 * resolution and the settings save.
 *
 * It runs for **every configured person**, not just whoever is selected in
 * the view. The grocery list is shared across a household, so its ledger is
 * fed by all of their plans at once, and state has to hold all of them.
 */
import { App } from 'obsidian';
import { localDateISO } from 'trail-core';
import { readPersons } from '../../crm/read-crm';
import type { CULItrailSettings, MealPlanEntry } from '../../settings/types';
import { entryInScope, type EntryScope } from './entries';
import { mealPlanNotePath } from './note-path';
import type { PlanEntryContent } from './plan-note';
import { readPlanFor } from './read-plans';
import { dropOrphanedPersons, reconcileMealPlan, type NoteEntry } from './reconcile';

/** A new entry id. Random rather than sequential, since two devices can sync the same week without seeing each other. */
export function newEntryId(): string {
  return `mp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface SyncResult {
  entries: MealPlanEntry[];
  /** Created by this pass. Auto-add runs against these, once each, and nothing else. */
  added: MealPlanEntry[];
  /** Gone from their notes. Their grocery contributions are withdrawn by the caller. */
  removed: MealPlanEntry[];
  changed: boolean;
}

/** Turns one note's entries into the shape reconcile understands, resolving each wikilink to a path. */
function toNoteEntries(app: App, entries: PlanEntryContent[], fromPath: string): NoteEntry[] {
  const resolved: NoteEntry[] = [];

  for (const entry of entries) {
    const shared = {
      id: entry.id,
      day: entry.day ?? undefined,
      meal: entry.slot ?? undefined,
      rating: entry.rating ?? undefined,
      isLeftovers: entry.isLeftovers,
      eaten: entry.eaten,
    };

    if (entry.mealTitle) {
      // A wikilink that resolves to nothing is skipped rather than kept as a
      // label: the note means a meal, and inventing a plain meal named after a
      // broken link would put a meal in the plan nobody planned.
      const file = app.metadataCache.getFirstLinkpathDest(entry.mealTitle, fromPath);
      if (!file) continue;

      resolved.push({ ...shared, mealPath: file.path });
      continue;
    }

    if (!entry.label) continue;
    resolved.push({ ...shared, mealPath: '', label: entry.label });
  }

  return resolved;
}

/**
 * Reconciles one person's note for one week.
 *
 * A missing note leaves that person's entries alone rather than deleting
 * them. The note may simply not have been created yet, and treating "no file"
 * as "an empty plan" would wipe a week the moment a sync ran before anything
 * was written.
 */
async function syncOnePerson(
  app: App,
  settings: CULItrailSettings,
  entries: MealPlanEntry[],
  scope: EntryScope
): Promise<SyncResult> {
  const unchanged = { entries, added: [], removed: [], changed: false };

  const path = mealPlanNotePath(settings, scope.week, scope.person);
  if (!path) return unchanged;

  const plan = await readPlanFor(app, settings, path);
  if (!plan) return unchanged;

  const inScope = entries.filter((entry) => entryInScope(entry, scope));
  const result = reconcileMealPlan(toNoteEntries(app, plan.entries, path), inScope, {
    scope,
    newId: newEntryId,
    today: localDateISO(),
  });

  const outOfScope = entries.filter((entry) => !entryInScope(entry, scope));

  return {
    entries: [...outOfScope, ...result.entries],
    added: result.added,
    removed: result.removed,
    changed: result.changed,
  };
}

/**
 * Reconciles one week across every configured person.
 *
 * Deliberately every configured Person, not the eligible-tag subset the
 * person picker offers. Somebody who has since fallen out of that filter must
 * keep the plan they already have rather than have it silently stop updating;
 * the filter narrows who can be *chosen*, not whose data is allowed to exist.
 */
export async function syncMealPlanWeek(
  app: App,
  settings: CULItrailSettings,
  week: string
): Promise<SyncResult> {
  // Every configured Person, read straight from the vault rather than
  // through the eligibility filter. See the note above.
  const persons = readPersons(app, settings).map((person) => person.title);

  let entries = settings.state.mealPlan;
  const added: MealPlanEntry[] = [];
  const removed: MealPlanEntry[] = [];
  let changed = false;

  // A vault with no People notes still plans meals. Its entries carry an
  // empty person, and one pass over that scope is the whole sync.
  for (const person of persons.length > 0 ? persons : ['']) {
    const result = await syncOnePerson(app, settings, entries, { week, person });
    entries = result.entries;
    added.push(...result.added);
    removed.push(...result.removed);
    if (result.changed) changed = true;
  }

  // Only when there are people to compare against. With none configured
  // every entry carries an empty person and none is orphaned.
  if (persons.length > 0) {
    const pruned = dropOrphanedPersons(entries, persons);
    entries = pruned.entries;
    if (pruned.changed) changed = true;
  }

  return { entries, added, removed, changed };
}
