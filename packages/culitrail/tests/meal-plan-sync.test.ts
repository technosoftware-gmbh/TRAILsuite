/**
 * Reconciling state against a meal-plan note, and the batch scheduler.
 *
 * The note wins, always. These tests are mostly about the cases where that
 * rule is easy to get wrong: the same meal twice in one week, a line edited
 * rather than deleted, and an entry belonging to somebody who is no longer in
 * the vault.
 */
import { describe, expect, it } from 'vitest';
import { MealPlanEntry } from '../src/settings/types';
import {
  dropOrphanedPersons,
  reconcileMealPlan,
  type NoteEntry,
} from '../src/planning/meal-plan/reconcile';
import { isDayAvailable, planSchedule } from '../src/planning/meal-plan/schedule';

const scope = { week: '2026-W33', person: 'Stefan' };

function options() {
  let next = 0;
  return { scope, newId: () => `id-${++next}`, today: '2026-08-10' };
}

function noted(overrides: Partial<NoteEntry> = {}): NoteEntry {
  // `id: ''` is the checklist shape the type documents -- an entry with no
  // identity of its own. The builder left it undefined, which is not a shape a
  // note can be in, and which matching treats differently from an empty id.
  return {
    id: '',
    mealPath: 'Meals/Risotto.md',
    isLeftovers: false,
    eaten: false,
    ...overrides,
  };
}

function entry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: 'existing',
    mealPath: 'Meals/Risotto.md',
    addedDate: '2026-08-01',
    week: scope.week,
    person: scope.person,
    ...overrides,
  };
}

describe('reconcileMealPlan', () => {
  it('creates an entry for a line state has never seen', () => {
    const result = reconcileMealPlan([noted({ day: 'monday' })], [], options());
    expect(result.added).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      mealPath: 'Meals/Risotto.md',
      day: 'monday',
      week: scope.week,
      person: scope.person,
    });
    expect(result.changed).toBe(true);
  });

  it('keeps an entry the note still holds, without recreating it', () => {
    const existing = entry({ day: 'monday' });
    const result = reconcileMealPlan([noted({ day: 'monday' })], [existing], options());
    expect(result.entries).toEqual([existing]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toBe(false);
  });

  it('removes an entry the note no longer holds', () => {
    const result = reconcileMealPlan([], [entry({ day: 'monday' })], options());
    expect(result.entries).toEqual([]);
    expect(result.removed).toHaveLength(1);
    expect(result.changed).toBe(true);
  });

  it('keeps the same meal planned twice in one week', () => {
    // The inherited version keys a Map by meal path, so the second line
    // silently overwrites the first and you cannot eat the same thing twice.
    const result = reconcileMealPlan(
      [noted({ day: 'monday' }), noted({ day: 'thursday' })],
      [],
      options()
    );
    expect(result.entries.map((item) => item.day)).toEqual(['monday', 'thursday']);
  });

  it('keeps two identical lines on the same day as two meals', () => {
    const result = reconcileMealPlan(
      [noted({ day: 'monday' }), noted({ day: 'monday' })],
      [],
      options()
    );
    expect(result.entries).toHaveLength(2);
  });

  it('drops only the surplus when a duplicate line is deleted', () => {
    const both = [entry({ id: 'a', day: 'monday' }), entry({ id: 'b', day: 'monday' })];
    const result = reconcileMealPlan([noted({ day: 'monday' })], both, options());
    expect(result.entries.map((item) => item.id)).toEqual(['a']);
    expect(result.removed.map((item) => item.id)).toEqual(['b']);
  });

  it('adopts a rating or the leftovers mark added by hand', () => {
    const existing = entry({ day: 'monday' });
    const result = reconcileMealPlan(
      [noted({ day: 'monday', rating: 4, isLeftovers: true })],
      [existing],
      options()
    );
    expect(result.entries[0]).toMatchObject({ rating: 4, isLeftovers: true });
    expect(result.changed).toBe(true);
  });

  it('treats a move between days as a removal and an addition', () => {
    // Not an update: what was attributed to Monday has to be withdrawn from
    // it, and the caller only knows to do that from the removal.
    const result = reconcileMealPlan(
      [noted({ day: 'thursday' })],
      [entry({ day: 'monday' })],
      options()
    );
    expect(result.added).toHaveLength(1);
    expect(result.removed).toHaveLength(1);
  });

  it('matches a plain meal line by its label and day', () => {
    const existing = entry({ mealPath: '', label: 'Grilled cheese', day: 'monday' });
    const result = reconcileMealPlan(
      [noted({ mealPath: '', label: 'grilled CHEESE', day: 'monday' })],
      [existing],
      options()
    );
    expect(result.entries).toEqual([existing]);
    expect(result.added).toEqual([]);
  });

  it('does not confuse a meal with a plain meal of the same name', () => {
    const result = reconcileMealPlan(
      [noted({ mealPath: '', label: 'Meals/Risotto.md', day: 'monday' })],
      [entry({ day: 'monday' })],
      options()
    );
    expect(result.added).toHaveLength(1);
    expect(result.removed).toHaveLength(1);
  });

  it('does not collide two entries whose parts concatenate the same way', () => {
    // The identity key joins meal, day and slot. A separator that could
    // occur in a path would make these two the same entry.
    const result = reconcileMealPlan(
      [noted({ mealPath: 'A B.md' }), noted({ mealPath: 'A', day: 'B' })],
      [],
      options()
    );
    expect(result.entries).toHaveLength(2);
  });
});

describe('dropOrphanedPersons', () => {
  it('drops an entry naming somebody the vault no longer has', () => {
    // Nothing else ever reconciles it: the sync loops over configured people,
    // so this entry is seen by nobody and sits in state forever.
    const entries = [entry({ id: 'a' }), entry({ id: 'b', person: 'Departed Guest' })];
    const result = dropOrphanedPersons(entries, ['Stefan']);
    expect(result.entries.map((item) => item.id)).toEqual(['a']);
    expect(result.changed).toBe(true);
  });

  it('leaves an entry with no person alone', () => {
    // That is what a vault with no People notes writes, and it is read
    // normally.
    const entries = [entry({ id: 'a', person: undefined })];
    expect(dropOrphanedPersons(entries, ['Stefan']).entries).toHaveLength(1);
  });
});

describe('isDayAvailable', () => {
  const plan = [
    { day: 'monday', meal: 'dinner' },
    { day: 'tuesday', meal: 'lunch' },
  ];

  it('skips any occupied day in skip-occupied', () => {
    expect(isDayAvailable('monday', 'lunch', 'skip-occupied', plan)).toBe(false);
    expect(isDayAvailable('wednesday', 'lunch', 'skip-occupied', plan)).toBe(true);
  });

  it('allows a different slot on the same day in one-per-slot', () => {
    expect(isDayAvailable('monday', 'lunch', 'one-per-slot', plan)).toBe(true);
    expect(isDayAvailable('monday', 'dinner', 'one-per-slot', plan)).toBe(false);
  });

  it('degrades to one per day when no slot was chosen', () => {
    // There is nothing to distinguish meals by, so stacking them silently
    // would not be what was asked for.
    expect(isDayAvailable('monday', undefined, 'one-per-slot', plan)).toBe(false);
  });
});

describe('planSchedule', () => {
  const meals = ['a.md', 'b.md', 'c.md'];

  it('fills the earliest free days in week order', () => {
    const placed = planSchedule(meals, [], {
      mode: 'skip-occupied',
      overflowToQueue: true,
    });
    expect(placed.map((item) => item.day)).toEqual(['monday', 'tuesday', 'wednesday']);
  });

  it('sees its own placements, so a batch does not pile onto one day', () => {
    const placed = planSchedule(meals, [{ day: 'monday', meal: undefined }], {
      mode: 'skip-occupied',
      overflowToQueue: true,
    });
    expect(placed.map((item) => item.day)).toEqual(['tuesday', 'wednesday', 'thursday']);
  });

  it('deals round-robin when stacking freely', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const placed = planSchedule(many, [], { mode: 'stack-freely', overflowToQueue: false });
    expect(placed.map((item) => item.day)).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
      'monday',
    ]);
  });

  it('queues everything in queue-only, keeping the chosen slot', () => {
    const placed = planSchedule(meals, [], {
      mode: 'queue-only',
      slot: 'dinner',
      overflowToQueue: false,
    });
    expect(placed.every((item) => item.day === null && item.slot === 'dinner')).toBe(true);
  });

  it('overflows to the queue with no slot once the week is full', () => {
    // An overflow did not get the placement that was asked for, so claiming
    // its slot would overstate what happened.
    const full = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const placed = planSchedule(full, [], {
      mode: 'skip-occupied',
      slot: 'dinner',
      overflowToQueue: true,
    });
    expect(placed[7]).toEqual({ mealPath: 'h', day: null });
  });

  it('drops what does not fit when overflow is off', () => {
    const full = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const placed = planSchedule(full, [], { mode: 'skip-occupied', overflowToQueue: false });
    expect(placed).toHaveLength(7);
  });
});
