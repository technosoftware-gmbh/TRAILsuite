/**
 * One day out of the week's plan.
 *
 * The weekday mapping is the part worth pinning down: `getDay()` is
 * Sunday-first and the planning area is Monday-first, so an off-by-one here
 * would silently show yesterday's dinner all day Monday.
 */
import { describe, expect, it } from 'vitest';
import {
  agendaForDay,
  mealRank,
  mealsPerDay,
  weekdayKeyOf,
} from '../src/planning/view-model/day-agenda';
import type { MealPlanEntry } from '../src/settings/types';

function entry(partial: Partial<MealPlanEntry>): MealPlanEntry {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    mealPath: 'Eating/Meals/Risotto.md',
    week: '2026-W33',
    person: 'Stefan Muster',
    addedDate: '2026-08-10',
    ...partial,
  };
}

describe('weekdayKeyOf', () => {
  it('maps a date onto the Monday-first key list', () => {
    expect(weekdayKeyOf(new Date(2026, 7, 10))).toBe('monday');
    expect(weekdayKeyOf(new Date(2026, 7, 15))).toBe('saturday');
    // The one JavaScript gets backwards: getDay() calls this 0.
    expect(weekdayKeyOf(new Date(2026, 7, 16))).toBe('sunday');
  });
});

describe('mealRank', () => {
  it('orders the four slots as a day is eaten', () => {
    expect(mealRank('breakfast')).toBeLessThan(mealRank('dinner'));
  });

  it('puts an entry with no slot last rather than dropping it', () => {
    // The meal-plan view allows a meal on a day without a slot, and a plan
    // that hides part of itself is worse than a loosely ordered one.
    expect(mealRank(undefined)).toBeGreaterThan(mealRank('snack'));
    expect(mealRank('elevenses')).toBeGreaterThan(mealRank('snack'));
  });
});

describe('agendaForDay', () => {
  const scope = { week: '2026-W33', person: 'Stefan Muster', day: 'monday' as const };

  it('is one person, one week, one day, breakfast first', () => {
    const entries = [
      entry({ id: 'dinner', day: 'monday', meal: 'dinner' }),
      entry({ id: 'breakfast', day: 'monday', meal: 'breakfast' }),
      entry({ id: 'tuesday', day: 'tuesday', meal: 'lunch' }),
      entry({ id: 'other-week', day: 'monday', meal: 'lunch', week: '2026-W34' }),
      entry({ id: 'other-person', day: 'monday', meal: 'lunch', person: 'Ada Lovelace' }),
    ];
    expect(agendaForDay(entries, scope).map((item) => item.id)).toEqual(['breakfast', 'dinner']);
  });

  it('leaves out the queue, which is wanted rather than planned', () => {
    expect(agendaForDay([entry({ meal: 'dinner' })], scope)).toEqual([]);
  });
});

describe('mealsPerDay', () => {
  const scope = { week: '2026-W33', person: 'Stefan Muster' };

  it('counts every weekday, including the empty ones', () => {
    const counts = mealsPerDay(
      [entry({ day: 'monday' }), entry({ day: 'monday' }), entry({ day: 'friday' })],
      scope
    );
    expect(counts.get('monday')).toBe(2);
    expect(counts.get('friday')).toBe(1);
    // Present with a zero rather than absent, so the strip always has seven
    // cells and an empty Thursday is visible as such.
    expect(counts.get('thursday')).toBe(0);
    expect(counts.size).toBe(7);
  });

  it('does not count the queue, which would make an empty week look full', () => {
    const counts = mealsPerDay([entry({}), entry({ day: 'monday' })], scope);
    expect([...counts.values()].reduce((sum, count) => sum + count, 0)).toBe(1);
  });
});
