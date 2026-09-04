/**
 * The itinerary block's one piece of non-DOM logic: how stops become days.
 * The rendering itself is App-dependent DOM building and is left untested,
 * the same boundary the rest of the codebase draws.
 */
import { describe, expect, it } from 'vitest';
import { aStop } from './fixtures';
import { groupStopsByDay, itineraryDays, spannedDates } from '../src/trips/itinerary-days';
import { TravelTripStop } from '../src/vault/types';

function stop(placeTitle: string, from: string | null = null): TravelTripStop {
  return aStop({ placeTitle, from });
}

/** A stop on a trip that has no dates yet: it says which day it is on and nothing more. */
function onDay(placeTitle: string, day: number, from: string | null = null): TravelTripStop {
  return { ...stop(placeTitle, from), day };
}

describe('groupStopsByDay', () => {
  it('puts a single day trip in one group', () => {
    const groups = groupStopsByDay([
      stop('Outlet', '2026-02-13T09:30'),
      stop('Falknis', '2026-02-13T12:00'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe('2026-02-13');
    expect(groups[0].stops.map((s) => s.placeTitle)).toEqual(['Outlet', 'Falknis']);
  });

  it('starts a new group when the date changes', () => {
    const groups = groupStopsByDay([
      stop('Day one', '2026-04-26T19:00'),
      stop('Day two', '2026-04-27T10:00'),
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-04-26', '2026-04-27']);
  });

  it('attaches an untimed stop to the day being built, not a group of its own', () => {
    const groups = groupStopsByDay([
      stop('Outlet', '2026-02-13T09:30'),
      stop('Somewhere'),
      stop('Falknis', '2026-02-13T12:00'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].stops.map((s) => s.placeTitle)).toEqual(['Outlet', 'Somewhere', 'Falknis']);
  });

  it('puts stops before any dated stop in a leading undated group', () => {
    const groups = groupStopsByDay([stop('Somewhere'), stop('Outlet', '2026-02-13T09:30')]);
    expect(groups.map((g) => g.date)).toEqual([null, '2026-02-13']);
  });

  it('keeps a fully undated itinerary as one undated group', () => {
    const groups = groupStopsByDay([stop('A'), stop('B')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBeNull();
  });

  it('does not merge two visits to the same day that are separated by another day', () => {
    const groups = groupStopsByDay([
      stop('Morning', '2026-04-26T09:00'),
      stop('Next day', '2026-04-27T09:00'),
      stop('Back again', '2026-04-26T20:00'),
    ]);
    // Three groups, not two: the itinerary's own order is authoritative,
    // and re-merging would silently reorder what the author wrote.
    expect(groups.map((g) => g.date)).toEqual(['2026-04-26', '2026-04-27', '2026-04-26']);
  });

  it('returns nothing for an empty itinerary', () => {
    expect(groupStopsByDay([])).toEqual([]);
  });
});

describe('spannedDates', () => {
  it('returns one date when a leg starts and ends on the same day', () => {
    expect(spannedDates('2026-08-08T08:00', '2026-08-08T15:30')).toEqual(['2026-08-08']);
  });

  it('returns both dates when a leg crosses midnight', () => {
    // The reported bug: an outbound leg on the 8th and an inbound leg on
    // the 12th both rendered as bare time ranges, indistinguishable.
    expect(spannedDates('2026-08-08T08:00', '2026-08-12T15:30')).toEqual([
      '2026-08-08',
      '2026-08-12',
    ]);
  });

  it('returns the one date it has when only half the pair is set', () => {
    expect(spannedDates('2026-08-08T08:00', null)).toEqual(['2026-08-08']);
    expect(spannedDates(null, '2026-08-12')).toEqual(['2026-08-12']);
  });

  it('returns nothing when neither value carries a date', () => {
    expect(spannedDates(null, null)).toEqual([]);
  });

  it('ignores the time when deciding whether two values share a day', () => {
    expect(spannedDates('2026-08-08T00:01', '2026-08-08T23:59')).toEqual(['2026-08-08']);
  });
});

/**
 * An itinerary written before anybody knows the dates.
 *
 * The case the whole relative-day model exists for: twelve numbered days, a
 * restaurant on one and a hotel on another, and no calendar anywhere. Grouping
 * by date would collapse all twelve into one undated heap, which is what it did
 * before the key stopped being the date.
 */
describe('grouping a trip that has no dates yet', () => {
  it('breaks into its numbered days', () => {
    const groups = groupStopsByDay([
      onDay('Pretoria', 1),
      onDay('Rovos Rail', 1),
      onDay('Kimberley', 2),
    ]);

    expect(groups.map((g) => g.number)).toEqual([1, 2]);
    expect(groups.map((g) => g.date)).toEqual([null, null]);
    expect(groups[0].stops.map((s) => s.placeTitle)).toEqual(['Pretoria', 'Rovos Rail']);
  });

  it('gives every day a date once the trip has a departure', () => {
    const groups = groupStopsByDay([onDay('Pretoria', 1), onDay('Kimberley', 2)], '2026-11-02');

    expect(groups.map((g) => g.date)).toEqual(['2026-11-02', '2026-11-03']);
    expect(groups.map((g) => g.number)).toEqual([1, 2]);
  });

  /** Setting the departure must not resplit or reorder anything: it is the same twelve days with dates on them. */
  it('groups the same way dated and undated', () => {
    const stops = [onDay('Pretoria', 1), onDay('Rovos Rail', 1), onDay('Kimberley', 2)];

    expect(groupStopsByDay(stops).map((g) => g.stops.length)).toEqual(
      groupStopsByDay(stops, '2026-11-02').map((g) => g.stops.length)
    );
  });

  /** A dated day knows its number too, so a header can say "Day 3" on a planned trip. */
  it('derives the day number of a dated stop', () => {
    const groups = groupStopsByDay([stop('Kimberley', '2026-11-04T09:00')], '2026-11-02');

    expect(groups[0].number).toBe(3);
  });

  it('leaves the number unknown when the stop is dated and the trip is not', () => {
    expect(groupStopsByDay([stop('Kimberley', '2026-11-04T09:00')])[0].number).toBeNull();
  });

  /** A day number and the date it resolves to are the same day, and must not split. */
  it('does not split a day half-written as a number and half as a date', () => {
    const groups = groupStopsByDay(
      [onDay('Pretoria', 3), stop('Kimberley', '2026-11-04T14:00')],
      '2026-11-02'
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe('2026-11-04');
  });
});

/**
 * A day that says something for itself.
 *
 * The brochure heads a day "1. Tag: Pretoria" and sometimes gives it a
 * paragraph. The list is sparse -- only days that say something have an entry
 * -- and a day is still derived from the items on it, so the two have to be
 * merged without the annotation taking ownership of anything.
 */
describe('a day with a title of its own', () => {
  it('puts the title on the day its number names', () => {
    const groups = itineraryDays([onDay('Pretoria', 1), onDay('Kimberley', 2)], null, [
      { day: 2, title: 'Kimberley', note: 'Die Diamantenstadt.' },
    ]);

    expect(groups.map((g) => g.title)).toEqual([null, 'Kimberley']);
    expect(groups[1].note).toBe('Die Diamantenstadt.');
  });

  /** The case the merge exists for: a day of a cruise with nothing booked on it. */
  it('shows a titled day that has no stops at all', () => {
    const groups = itineraryDays([onDay('Pretoria', 1), onDay('Windhoek', 5)], null, [
      { day: 3, title: 'Seetag', note: null },
    ]);

    expect(groups.map((g) => g.number)).toEqual([1, 3, 5]);
    expect(groups[1].stops).toEqual([]);
    expect(groups[1].title).toBe('Seetag');
  });

  it('puts a stopless day after every day numbered below it', () => {
    const groups = itineraryDays([onDay('Pretoria', 1)], null, [
      { day: 9, title: 'Sossusvlei', note: null },
    ]);

    expect(groups.map((g) => g.number)).toEqual([1, 9]);
  });

  it('gives a stopless day its date once the trip has a departure', () => {
    const groups = itineraryDays([onDay('Pretoria', 1)], '2026-11-02', [
      { day: 3, title: 'Seetag', note: null },
    ]);

    expect(groups[1].date).toBe('2026-11-04');
  });

  /**
   * The older rule outranks the merge: days appear in the order their first
   * stop does, and nothing that has stops is moved. Only the stopless day is
   * placed.
   *
   * **Where it lands among days written out of order is deliberately not
   * asserted.** An itinerary listing day 5 before day 2 has no right answer
   * for where day 3 goes, and pinning one would be pinning an accident. What
   * has an answer is that 5 still comes before 2.
   */
  it('never reorders a day that has stops', () => {
    const groups = itineraryDays([onDay('Later', 5), onDay('Earlier', 2)], null, [
      { day: 3, title: 'Between', note: null },
    ]);

    const withStops = groups.filter((g) => g.stops.length > 0).map((g) => g.number);
    expect(withStops).toEqual([5, 2]);
    expect(groups).toHaveLength(3);
  });

  it('annotates nothing when the trip names no days', () => {
    expect(itineraryDays([onDay('Pretoria', 1)]).map((g) => g.title)).toEqual([null]);
  });
});
