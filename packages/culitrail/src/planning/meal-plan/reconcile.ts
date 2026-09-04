/**
 * Making state agree with a meal-plan note.
 *
 * **The note wins, always.** State is a mirror of what the notes say, kept
 * because the reconciler needs every person's plan for a week at once and
 * re-reading seven notes on every render would be absurd. Reconciliation is
 * therefore one-directional: whatever the note says is the answer, and an
 * entry state holds that the note does not is stale, not authoritative.
 *
 * A pure function, deliberately. The inherited version interleaves this
 * decision with vault reads and a settings save, so the only
 * way to exercise a rule such as "the same meal twice in one week" is to
 * run Obsidian and look. Everything that needs an `App` lives in sync.ts.
 *
 * App-free.
 */
import type { MealPlanEntry } from '../../settings/types';
import type { EntryScope } from './entries';

/** One entry of a note, resolved: a meal path if the wikilink pointed at one, or a label. */
export interface NoteEntry {
  /**
   * The entry's own id, when the note carries one.
   *
   * Empty for a note still in the checklist shape, where most entries had no
   * identity at all. Matching on it is what lets a meal moved from Monday to
   * Thursday stay the same entry rather than becoming a removal and an
   * addition.
   */
  id: string;
  /** '' for an entry naming a meal directly rather than linking a meal. */
  mealPath: string;
  label?: string;
  day?: string;
  meal?: string;
  rating?: number;
  isLeftovers: boolean;
  /**
   * The state of the line's checkbox: the meal was eaten, not merely planned.
   *
   * Carried through because the note says it and state is a mirror of the
   * note. It was read by the parser and dropped here, so a ticked box was
   * invisible to everything downstream and every line the renderer wrote came
   * out unticked – which is why recording a cook could not be made to write a
   * plan line without this.
   */
  eaten: boolean;
}

export interface ReconcileOptions {
  scope: EntryScope;
  /** Injected so a test gets stable ids and so nothing here reaches for a clock or a random source. */
  newId: () => string;
  /** Today, as an ISO date. Stamped on entries this pass creates. */
  today: string;
}

export interface ReconcileResult {
  /** Every in-scope entry after reconciling. Replaces the in-scope slice of state. */
  entries: MealPlanEntry[];
  /** Entries created by this pass. */
  added: MealPlanEntry[];
  /** Entries the note no longer holds. */
  removed: MealPlanEntry[];
  /** True when anything at all differs, so a caller can skip a save. */
  changed: boolean;
}

/** Cannot occur in a path, a weekday key or a slot key, so two triples can never collide by concatenation. */
const SEPARATOR = '\u0000';

/**
 * What makes two entries the same entry.
 *
 * Meal, day and slot together, **not the meal alone**. The inherited
 * version keys a Map by meal path, so a note planning the same meal for
 * Monday and Thursday collapses to one entry and the second silently
 * overwrites the first: you cannot eat the same thing twice in a week. A
 * label-only line is identified by its text instead, since it has no meal.
 *
 * The separator is a null byte, which cannot occur in a path, a weekday key
 * or a slot key, so two different triples can never collide by concatenation.
 */
function identity(entry: {
  mealPath: string;
  label?: string;
  day?: string;
  meal?: string;
}): string {
  const subject = entry.mealPath || `label:${(entry.label ?? '').trim().toLowerCase()}`;
  return [subject, entry.day ?? '', entry.meal ?? ''].join(SEPARATOR);
}

/** Buckets by identity, keeping duplicates, so two identical lines really do mean two meals. */
function bucket<T extends { mealPath: string; label?: string; day?: string; meal?: string }>(
  items: T[]
): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = identity(item);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  return buckets;
}

function createEntry(noted: NoteEntry, options: ReconcileOptions): MealPlanEntry {
  return {
    // The note's own id when it states one, so state and note agree about
    // which entry this is from the first pass rather than from the second.
    id: noted.id || options.newId(),
    mealPath: noted.mealPath,
    label: noted.mealPath ? undefined : noted.label,
    day: noted.day,
    meal: noted.meal,
    person: options.scope.person,
    week: options.scope.week,
    rating: noted.rating,
    isLeftovers: noted.isLeftovers || undefined,
    eaten: noted.eaten || undefined,
    addedDate: options.today,
  };
}

/**
 * Copies every field the note owns onto the state entry it was paired with.
 *
 * All of them, including the day and the slot, which the identity-based
 * version could not do: two entries that differed by day were two identities,
 * so moving a meal was a removal and an addition. An entry paired by its id is
 * the same entry however much of it has changed, and this is where that shows.
 */
function applyNoteFields(entry: MealPlanEntry, noted: NoteEntry): boolean {
  let changed = false;

  const set = <K extends keyof MealPlanEntry>(key: K, value: MealPlanEntry[K]): void => {
    if (entry[key] === value) return;
    entry[key] = value;
    changed = true;
  };

  set('mealPath', noted.mealPath);
  set('label', noted.mealPath ? undefined : noted.label);
  set('day', noted.day);
  set('meal', noted.meal);
  set('rating', noted.rating);
  set('isLeftovers', noted.isLeftovers || undefined);
  set('eaten', noted.eaten || undefined);

  return changed;
}

/**
 * Makes state agree with what the note says.
 *
 * Two passes, and the order is the point. **By id first**, because a converted
 * note states one per entry and an id is a better answer than any amount of
 * guessing from what an entry says. **Then by identity**, for the entries a
 * note in the old checklist shape has no id for, which is the rule this
 * function used to run on alone: meal, day and slot together, never the meal
 * alone, so a week planning the same dish on Monday and Thursday keeps both.
 *
 * The result comes back in the note's own order rather than grouped, so a view
 * rendering it reads down the week the way the note does.
 */
export function reconcileMealPlan(
  noteEntries: NoteEntry[],
  existing: MealPlanEntry[],
  options: ReconcileOptions
): ReconcileResult {
  const byId = new Map<string, MealPlanEntry>();
  for (const entry of existing) if (entry.id) byId.set(entry.id, entry);

  const claimed = new Set<MealPlanEntry>();
  const pairs = noteEntries.map((noted) => {
    const match = noted.id ? byId.get(noted.id) : undefined;
    if (!match || claimed.has(match)) return { noted, match: null };

    claimed.add(match);
    return { noted, match };
  });

  const leftover = bucket(existing.filter((entry) => !claimed.has(entry)));
  let adopted = false;

  for (const pair of pairs) {
    if (pair.match) continue;

    const match = leftover.get(identity(pair.noted))?.shift();
    if (!match) continue;

    claimed.add(match);
    pair.match = match;

    // Paired by what it is, so take the id the note gives it. This is what
    // makes the second pass a one-off after a vault is converted: state was
    // holding ids of its own and the converted notes minted their own, and
    // without this the two would agree by identity forever and never by id.
    if (pair.noted.id && match.id !== pair.noted.id) {
      match.id = pair.noted.id;
      adopted = true;
    }
  }

  const entries: MealPlanEntry[] = [];
  const added: MealPlanEntry[] = [];
  let changed = adopted;

  for (const { noted, match } of pairs) {
    if (match) {
      if (applyNoteFields(match, noted)) changed = true;
      entries.push(match);
      continue;
    }

    const entry = createEntry(noted, options);
    entries.push(entry);
    added.push(entry);
    changed = true;
  }

  // Whatever nothing in the note claimed: somebody deleted it there.
  const removed = existing.filter((entry) => !claimed.has(entry));
  if (removed.length > 0) changed = true;

  return { entries, added, removed, changed };
}

/**
 * Drops entries naming a person who has no Person note.
 *
 * The reconcile pass runs once per configured person, so it never sees an
 * entry belonging to somebody who has since been renamed or removed: that
 * entry is reconciled by nobody and cleaned up by nobody, and sits in state
 * forever, invisible to every view.
 *
 * An entry with no person at all is left alone. That is what a vault with no
 * People configured writes, and it is read normally.
 */
export function dropOrphanedPersons(
  entries: MealPlanEntry[],
  configuredPersons: string[]
): { entries: MealPlanEntry[]; changed: boolean } {
  const configured = new Set(configuredPersons);
  const kept = entries.filter((entry) => !entry.person || configured.has(entry.person));
  return { entries: kept, changed: kept.length !== entries.length };
}
