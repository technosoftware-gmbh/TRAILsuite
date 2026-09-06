/**
 * Which legs land on a day of the itinerary.
 *
 * Legs live in their own band, deliberately: a return flight lands the day
 * after the trip ends and folding it into the days would file it under a day
 * it does not happen on. That reasoning covers a flight and does not cover a
 * fortnight-long voyage, whose arrival day is a real day of the itinerary with
 * stops on it -- and which, before this, appeared nowhere at all.
 */
import { describe, expect, it } from 'vitest';
import { legsArrivingOn, ArrivingLeg } from '../src/trips/leg-arrivals';

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
   * The return flight the day after a fifteen-day trip. Nothing filters it
   * here and nothing needs to: the itinerary has no day 16 to ask about, so
   * the leg is named on no day at all. That is what keeps the recorded reason
   * for the transport band intact -- a leg outside the trip's own days stays
   * outside its day-by-day.
   */
  it('is named on no day of the itinerary when it lands past the last one', () => {
    const homeward = leg({ day: 15, toDay: 16 });
    const days = [1, 7, 15].map((number) => ({ date: null, number }));

    expect(days.flatMap((day) => legsArrivingOn([homeward], day, null))).toEqual([]);
  });

  it('says nothing for a day nobody can identify', () => {
    expect(legsArrivingOn([VOYAGE], { date: null, number: null }, null)).toEqual([]);
  });
});
