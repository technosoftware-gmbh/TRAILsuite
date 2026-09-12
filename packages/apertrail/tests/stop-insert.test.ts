/**
 * Where a newly added stop lands in the list.
 *
 * Reported from real use: a stop added to day 3 of a twelve-day cruise
 * appeared under a second day-3 heading at the bottom of the itinerary, and
 * had to be dragged up by hand. `addStop` filled the day in correctly -- its
 * own comment says "a stop added to day 3 has to land on day 3" -- and then
 * the save appended, and the list IS the itinerary's order.
 */
import { describe, expect, it } from 'vitest';
import { stopDayNumber, stopInsertIndex } from '../src/trips/stop-insert';

const DEPARTURE = '2027-12-17';

/** A relative trip's stop: a day number and no date. */
const day = (n: number) => ({ day: n, from: null });

/** A dated trip's stop: a date and no number, because saying both would say the same thing twice. */
const on = (date: string) => ({ day: null, from: date });

describe('which day a stop falls on', () => {
  it('takes the number when the note carries one', () => {
    expect(stopDayNumber(day(3), DEPARTURE)).toBe(3);
  });

  /** The half of the schema a fix ordering only on `day` would have missed entirely. */
  it('works the number out from a date when the note carries one of those instead', () => {
    expect(stopDayNumber(on('2027-12-19'), DEPARTURE)).toBe(3);
  });

  it('says nothing for a stop that says nothing about when', () => {
    expect(stopDayNumber({ day: null, from: null }, DEPARTURE)).toBeNull();
  });

  /** A date means nothing without a departure to count from, and guessing would place the stop at random. */
  it('says nothing for a dated stop on a trip with no departure', () => {
    expect(stopDayNumber(on('2027-12-19'), null)).toBeNull();
  });
});

describe('where a new stop is inserted', () => {
  const trip = [day(1), day(2), day(3), day(3), day(12)];

  it('follows the last stop of its own day rather than displacing the first', () => {
    expect(stopInsertIndex(trip, day(3), DEPARTURE)).toBe(4);
  });

  it('goes before the first stop of a later day', () => {
    expect(stopInsertIndex(trip, day(4), DEPARTURE)).toBe(4);
  });

  it('goes to the end for a stop on the last day', () => {
    expect(stopInsertIndex(trip, day(12), DEPARTURE)).toBe(5);
  });

  it('goes to the end for a day past the last one', () => {
    expect(stopInsertIndex(trip, day(14), DEPARTURE)).toBe(5);
  });

  it('goes first for a stop before every day in the list', () => {
    expect(stopInsertIndex(trip, day(0), DEPARTURE)).toBe(0);
  });

  it('places a dated stop among day-numbered ones', () => {
    expect(stopInsertIndex(trip, on('2027-12-19'), DEPARTURE)).toBe(4);
  });

  it('places a day-numbered stop among dated ones', () => {
    const dated = [on('2027-12-17'), on('2027-12-19'), on('2027-12-28')];

    expect(stopInsertIndex(dated, day(3), DEPARTURE)).toBe(2);
  });

  /** It belongs to whatever run it is written next to, and only the person adding it knows which. */
  it('appends a stop that says nothing about when', () => {
    expect(stopInsertIndex(trip, { day: null, from: null }, DEPARTURE)).toBe(5);
  });

  it('appends to an empty itinerary', () => {
    expect(stopInsertIndex([], day(3), DEPARTURE)).toBe(0);
  });

  /**
   * A trip whose stops are deliberately out of day order stays exactly as it
   * is. The search stops at the first later day rather than scanning on, so
   * the new stop joins the run it belongs to instead of being carried past it.
   */
  it('stops at the first later day rather than scanning the whole list', () => {
    const outOfOrder = [day(1), day(5), day(2)];

    expect(stopInsertIndex(outOfOrder, day(3), DEPARTURE)).toBe(1);
  });

  /** Splitting the two would break up a pair somebody wrote next to each other. */
  it('carries a stop that says nothing about when along with the run above it', () => {
    const withGap = [day(1), { day: null, from: null }, day(5)];

    expect(stopInsertIndex(withGap, day(3), DEPARTURE)).toBe(2);
  });

  /** Nothing above it to belong to, so it keeps the head of the list. */
  it('leaves an opening stop that says nothing about when where it is', () => {
    const opensBlank = [{ day: null, from: null }, day(5)];

    expect(stopInsertIndex(opensBlank, day(3), DEPARTURE)).toBe(1);
  });
});
