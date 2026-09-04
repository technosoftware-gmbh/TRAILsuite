/**
 * A meal eaten, written where the plan can see it.
 *
 * One rule carries the suite: recording a meal somebody already planned marks
 * *that* entry rather than adding a second one, which is the difference between
 * one dinner and two. Everything else here is about what an already-recorded
 * meal is allowed to lose, which is nothing.
 */
import { describe, expect, it } from 'vitest';
import { applyEaten, personTitleOf } from '../src/planning/meal-plan/record-eating';
import { emptyPlanEntry, type PlanEntryContent } from '../src/planning/meal-plan/plan-note';

const planned = (overrides: Partial<PlanEntryContent> = {}): PlanEntryContent => ({
  ...emptyPlanEntry('e1'),
  mealTitle: 'Lasagne al forno',
  day: 'monday',
  slot: 'dinner',
  ...overrides,
});

const eaten = {
  mealTitle: 'Lasagne al forno',
  date: '2026-08-17T11:30',
  person: 'Stefan Muster',
  rating: 4,
  id: 'ch-1',
};

describe('personTitleOf', () => {
  it('takes the target out of a link, alias and heading and all', () => {
    expect(personTitleOf('[[Erika Muster]]')).toBe('Erika Muster');
    expect(personTitleOf('[[Erika Muster|Erika]]')).toBe('Erika Muster');
    expect(personTitleOf(undefined)).toBe('');
  });
});

describe('recording a meal the week planned', () => {
  it('marks the entry that is already there rather than adding a second', () => {
    const { entries, ticked } = applyEaten([planned()], eaten, 'monday');

    expect(ticked).toBe(true);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ eaten: true, rating: 4, time: '11:30' });
  });

  it('keeps the slot the plan gave it, since eating a lunch does not make it a dinner', () => {
    const { entries } = applyEaten([planned()], eaten, 'monday');
    expect(entries[0].slot).toBe('dinner');
  });

  it('keeps the id the entry already had, because an id is an identity', () => {
    const { entries } = applyEaten([planned({ id: 'planned-1' })], eaten, 'monday');
    expect(entries[0].id).toBe('planned-1');
  });

  it('adds beside an entry already eaten, since two helpings in a day happen', () => {
    const { entries, ticked } = applyEaten([planned({ eaten: true })], eaten, 'monday');

    expect(ticked).toBe(false);
    expect(entries).toHaveLength(2);
  });

  it('adds when the week planned it on another day', () => {
    const { entries, ticked } = applyEaten([planned({ day: 'friday' })], eaten, 'monday');

    expect(ticked).toBe(false);
    expect(entries[1]).toMatchObject({ day: 'monday', eaten: true });
  });
});

describe('recording a meal nobody planned', () => {
  it('adds it to the day it was eaten, marked, with its id', () => {
    const { entries, ticked } = applyEaten([], eaten, 'monday');

    expect(ticked).toBe(false);
    expect(entries[0]).toMatchObject({
      id: 'ch-1',
      mealTitle: 'Lasagne al forno',
      day: 'monday',
      eaten: true,
      rating: 4,
      time: '11:30',
    });
  });

  it('states no time when the date carries only a day', () => {
    const { entries } = applyEaten([], { ...eaten, date: '2026-08-17' }, 'monday');
    expect(entries[0].time).toBeNull();
  });

  it('states no rating for a zero, which used to need a magic value to say', () => {
    // The line format had one notation for "eaten" and "eaten, unrated", so it
    // wrote `[rating:: 0]` for the second. An entry says `eaten` outright now.
    const { entries } = applyEaten([], { ...eaten, rating: 0 }, 'monday');

    expect(entries[0]).toMatchObject({ eaten: true, rating: null });
  });

  it('keeps a remark, and writes none rather than an empty one', () => {
    expect(applyEaten([], { ...eaten, note: ' half a portion ' }, 'monday').entries[0].note).toBe(
      'half a portion'
    );
    expect(applyEaten([], { ...eaten, note: '   ' }, 'monday').entries[0].note).toBeNull();
  });
});
