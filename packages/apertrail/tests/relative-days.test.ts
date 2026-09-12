/**
 * A trip is a shape before it is a set of dates.
 *
 * The itinerary is written as day one, day two, day twelve, with no idea yet
 * which calendar days those are -- a brochure never says a date at all. Then a
 * departure gets fixed and every one of those days becomes a date, with not a
 * line of the note rewritten.
 *
 * Two things this suite exists to hold. **The resolution is one-way**: the note
 * keeps saying `day: 3` and the date is computed on every render, so moving the
 * departure moves the trip. And **an absent day is not day zero** -- the whole
 * relative branch turns on telling "no day" from a day number, and null and
 * undefined both have to mean the first.
 */
import { describe, expect, it } from 'vitest';
import {
  clockTime,
  dateOfDay,
  dayKey,
  dayOfDate,
  endpointDate,
  tripDayCount,
} from '../src/trips/relative-days';

const DEPARTURE = '2026-11-02';

describe('resolving a day against the departure', () => {
  it('makes day one the departure day', () => {
    expect(dateOfDay(DEPARTURE, 1)).toBe('2026-11-02');
  });

  it('counts forward from there', () => {
    expect(dateOfDay(DEPARTURE, 12)).toBe('2026-11-13');
  });

  /** An overnight flight leaving the evening before is day 0, not an error. */
  it('allows a day before the trip starts', () => {
    expect(dateOfDay(DEPARTURE, 0)).toBe('2026-11-01');
  });

  it('crosses a month boundary by counting days, not by arithmetic on the number', () => {
    expect(dateOfDay('2026-11-28', 5)).toBe('2026-12-02');
  });

  it('gives nothing for a trip that has no departure yet', () => {
    expect(dateOfDay(null, 3)).toBeNull();
  });

  it('reads the date out of a departure that carries a time', () => {
    expect(dateOfDay('2026-11-02T09:00', 2)).toBe('2026-11-03');
  });
});

describe('the day a date falls on', () => {
  it('is the inverse of resolving one', () => {
    expect(dayOfDate(DEPARTURE, '2026-11-13')).toBe(12);
  });

  it('is one on the departure day itself', () => {
    expect(dayOfDate(DEPARTURE, DEPARTURE)).toBe(1);
  });

  it('is nothing when either end is missing', () => {
    expect(dayOfDate(null, '2026-11-13')).toBeNull();
    expect(dayOfDate(DEPARTURE, null)).toBeNull();
  });
});

describe('the clock time on an endpoint', () => {
  it('reads a bare time, which is what a relative item carries', () => {
    expect(clockTime('10:00')).toBe('10:00');
  });

  it('reads the time out of a datetime, which is what an absolute one carries', () => {
    expect(clockTime('2026-11-04T10:00')).toBe('10:00');
  });

  /** A note halfway through being edited carries a day number and a leftover datetime. Throwing the time away would be the wrong half to lose. */
  it('reads both shapes, so a half-edited note keeps its time', () => {
    expect(clockTime('2026-11-04T22:30')).toBe('22:30');
    expect(clockTime('22:30')).toBe('22:30');
  });

  it('pads an hour somebody typed as one digit', () => {
    expect(clockTime('9:05')).toBe('09:05');
  });

  it('is nothing for a date with no time and for nothing at all', () => {
    expect(clockTime('2026-11-04')).toBeNull();
    expect(clockTime(null)).toBeNull();
  });
});

describe('when an endpoint happens', () => {
  it('resolves a day number through the departure', () => {
    expect(endpointDate({ day: 3, value: '10:00' }, DEPARTURE)).toBe('2026-11-04');
  });

  it('takes an absolute value at its word', () => {
    expect(endpointDate({ day: null, value: '2026-04-26T07:00' }, DEPARTURE)).toBe('2026-04-26');
  });

  /**
   * A day number beats a leftover datetime, because the day number is what
   * marks the item relative in the first place.
   */
  it('lets the day number win over a value that disagrees', () => {
    expect(endpointDate({ day: 3, value: '2026-04-26T07:00' }, DEPARTURE)).toBe('2026-11-04');
  });

  /**
   * An item assembled by hand leaves the sub-key off rather than passing null.
   * Reading that as "there is a day here" sent absolute stops down the relative
   * branch and lost their dates -- found by a fixture older than the field.
   */
  it('treats a missing day the same as no day', () => {
    expect(endpointDate({ day: undefined, value: '2026-04-26T07:00' }, DEPARTURE)).toBe(
      '2026-04-26'
    );
  });

  it('gives nothing for a day the trip cannot date yet', () => {
    expect(endpointDate({ day: 3, value: '10:00' }, null)).toBeNull();
  });
});

describe('the key a day groups under', () => {
  it('is the resolved date once the trip has one', () => {
    expect(dayKey({ day: 3, value: null }, DEPARTURE)).toBe('2026-11-04');
  });

  /** Without this an undated twelve-day brochure collapses into one heap. */
  it('is the day number while the trip has no dates', () => {
    expect(dayKey({ day: 3, value: null }, null)).toBe('#3');
  });

  it('is nothing for an item that says neither, which joins the day being built', () => {
    expect(dayKey({ day: null, value: null }, null)).toBeNull();
    expect(dayKey({ day: undefined, value: null }, null)).toBeNull();
  });

  /** Two ways of saying the same day have to key the same, or a planned trip splits in two. */
  it('agrees between a day number and the date it resolves to', () => {
    expect(dayKey({ day: 3, value: null }, DEPARTURE)).toBe(
      dayKey({ day: null, value: '2026-11-04T10:00' }, DEPARTURE)
    );
  });
});

describe('how long a trip runs', () => {
  it('is the span of its dates when it has them', () => {
    expect(tripDayCount(DEPARTURE, '2026-11-13', [])).toBe(12);
  });

  /** A relative trip can still say it is twelve days long: something on it says day twelve. */
  it('is the highest day anything names when it has no dates', () => {
    expect(tripDayCount(null, null, [1, 12, 4])).toBe(12);
  });

  it('is nothing when the trip says neither', () => {
    expect(tripDayCount(null, null, [null, null])).toBeNull();
  });

  it('prefers the dates over the day numbers, since the dates are the plan', () => {
    expect(tripDayCount(DEPARTURE, '2026-11-13', [40])).toBe(12);
  });
});
