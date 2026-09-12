/**
 * Which legs a day of the itinerary names.
 *
 * Legs live in their own band and are edited, priced and booked there. What a
 * day says is that something leaves or lands on it, which the band cannot say
 * because it has no days in it. The arrival came first, for the voyage that
 * runs a fortnight and used to end nowhere at all; the departure followed,
 * because a day one whose whole content is the flight out printed the day and
 * nothing about the flight.
 */
import { describe, expect, it } from 'vitest';
import { legsArrivingOn, legsDepartingOn, legDayNumbers, ArrivingLeg } from '../src/trips/leg-days';

function leg(over: Partial<ArrivingLeg> = {}): ArrivingLeg {
  return { day: null, toDay: null, from: null, to: null, ...over };
}

const VOYAGE = leg({ day: 1, toDay: 15 });

describe('a leg that runs for days', () => {
  it('is named on the day it arrives', () => {
    expect(legsArrivingOn([VOYAGE], { date: null, number: 15 }, null)).toEqual([VOYAGE]);
  });

  it('is not named on the day it leaves', () => {
    expect(legsArrivingOn([VOYAGE], { date: null, number: 1 }, null)).toEqual([]);
  });

  it('is not named on a day in between', () => {
    expect(legsArrivingOn([VOYAGE], { date: null, number: 7 }, null)).toEqual([]);
  });

  it('matches on the date once the trip has a departure', () => {
    // Day 1 is 2 November, so day 15 is 16 November.
    expect(legsArrivingOn([VOYAGE], { date: '2026-11-16', number: 15 }, '2026-11-02')).toEqual([
      VOYAGE,
    ]);
  });
});

describe('what is left out', () => {
  /** Its own row has been read in full; "arrives today" under the day it also began on says nothing new. */
  it('says nothing about a leg that lands the day it leaves', () => {
    const sameDay = leg({ day: 3, toDay: 3, from: '09:00', to: '13:00' });

    expect(legsArrivingOn([sameDay], { date: null, number: 3 }, null)).toEqual([]);
  });

  it('says nothing about a leg that names no arrival', () => {
    expect(
      legsArrivingOn([leg({ day: 3, from: '09:00' })], { date: null, number: 3 }, null)
    ).toEqual([]);
  });

  /**
   * The return flight lands the day after a fifteen-day trip, and is named on
   * that day rather than on one of the fifteen. Which day 16 the itinerary
   * draws is `itinerary-days.ts`'s half of the arrangement; this file only
   * refuses to file the leg under a day it does not happen on.
   */
  it('is named on its own day rather than on the last day of the trip', () => {
    const homeward = leg({ day: 15, toDay: 16 });
    const days = [1, 7, 15].map((number) => ({ date: null, number }));

    expect(days.flatMap((day) => legsArrivingOn([homeward], day, null))).toEqual([]);
    expect(legsArrivingOn([homeward], { date: null, number: 16 }, null)).toEqual([homeward]);
  });

  /**
   * `day: 1` with `toDay: 0`, which is what somebody writes when they read
   * the arrival field as "how many days later". Comparing the two day keys
   * called that an arrival and named it on a day 0 the trip has not got.
   */
  it('says nothing about an arrival earlier than the departure', () => {
    const backwards = leg({ day: 1, toDay: 0, from: '09:40', to: '12:10' });

    expect(legsArrivingOn([backwards], { date: null, number: 0 }, null)).toEqual([]);
    expect(legsArrivingOn([backwards], { date: null, number: 1 }, null)).toEqual([]);
  });

  it('says nothing for a day nobody can identify', () => {
    expect(legsArrivingOn([VOYAGE], { date: null, number: null }, null)).toEqual([]);
  });
});

describe('a leg leaving', () => {
  it('is named on the day it leaves', () => {
    expect(legsDepartingOn([VOYAGE], { date: null, number: 1 }, null)).toEqual([VOYAGE]);
  });

  it('is not named on the day it lands', () => {
    expect(legsDepartingOn([VOYAGE], { date: null, number: 15 }, null)).toEqual([]);
  });

  /** The case this was asked for: a morning flight that lands the same afternoon. */
  it('names a leg that leaves and lands on one day', () => {
    const sameDay = leg({ day: 1, toDay: 1, from: '09:40', to: '12:10' });

    expect(legsDepartingOn([sameDay], { date: null, number: 1 }, null)).toEqual([sameDay]);
  });

  it('names a leg whose arrival day is written backwards', () => {
    const backwards = leg({ day: 1, toDay: 0, from: '09:40', to: '12:10' });

    expect(legsDepartingOn([backwards], { date: null, number: 1 }, null)).toEqual([backwards]);
  });

  it('matches on the date once the trip has a departure', () => {
    expect(legsDepartingOn([VOYAGE], { date: '2026-11-02', number: 1 }, '2026-11-02')).toEqual([
      VOYAGE,
    ]);
  });

  it('says nothing about a leg that says no day at all', () => {
    expect(legsDepartingOn([leg()], { date: null, number: 1 }, null)).toEqual([]);
  });
});

/**
 * Which days the itinerary has to draw so that every leg has somewhere to be
 * named. Only the days something is actually named on, which is why the
 * backwards arrival above contributes one day rather than two.
 */
describe('the days the legs ask for', () => {
  it('asks for both ends of a voyage', () => {
    expect(legDayNumbers([VOYAGE], null)).toEqual([1, 15]);
  });

  it('asks only for the departure day of a leg that lands the same day', () => {
    expect(legDayNumbers([leg({ day: 3, toDay: 3, from: '09:00', to: '13:00' })], null)).toEqual([
      3,
    ]);
  });

  it('asks for no day earlier than the departure of a backwards leg', () => {
    expect(legDayNumbers([leg({ day: 1, toDay: 0 })], null)).toEqual([1]);
  });

  it('reads a day number off the dates once the trip has a departure', () => {
    const dated = leg({ day: null, toDay: null, from: '2026-11-04T09:00', to: '2026-11-06T18:00' });

    expect(legDayNumbers([dated], '2026-11-02')).toEqual([3, 5]);
  });

  it('asks for nothing on a trip whose legs and days are both undated', () => {
    expect(legDayNumbers([leg({ from: '2026-11-04T09:00' })], null)).toEqual([]);
  });
});
