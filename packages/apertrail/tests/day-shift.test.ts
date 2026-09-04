/**
 * Taking a day out of a trip, and putting one in.
 *
 * "Not two nights in Johannesburg but only one" is a whole day removed from
 * the middle, with everything after it moving up. This is the operation the
 * relative days exist for: on a numbered itinerary it is subtracting one from
 * some integers, and on a dated one it is retyping twelve dates.
 *
 * The rule the suite holds: **only stops are deleted.** A stay or a leg that
 * touched the removed day keeps its number and now means the following day.
 * Deleting a booked flight because somebody cut a day from the plan is the
 * more expensive of the two mistakes, and the cheaper one is visible in the
 * itinerary the moment it happens.
 */
import { describe, expect, it } from 'vitest';
import { insertDayBefore, removeDay, ShiftableTrip } from '../src/trips/day-shift';

/** Stefan's trip as it stood: four named days, a stay across the first two nights, an outbound on day 0. */
function trip(): ShiftableTrip {
  return {
    days: [{ day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }],
    stops: [{ day: 1 }, { day: 2 }, { day: 2 }, { day: 3 }, { day: 4 }, { day: null }],
    nights: [{ checkInDay: 1, checkOutDay: 3 }],
    transport: [{ day: 0, toDay: 1 }],
  };
}

describe('removing a day', () => {
  it('takes its own entry out and moves the later ones up', () => {
    const t = trip();
    removeDay(t, 2);

    expect(t.days.map((d) => d.day)).toEqual([1, 2, 3]);
  });

  it('deletes the stops that were on it', () => {
    const t = trip();
    removeDay(t, 2);

    expect(t.stops.filter((s) => s.day === 2)).toHaveLength(1);
    expect(t.stops).toHaveLength(4);
  });

  it('moves every later stop up by one', () => {
    const t = trip();
    removeDay(t, 2);

    expect(t.stops.map((s) => s.day)).toEqual([1, 2, 3, null]);
  });

  /** The case this was asked for: two nights in Johannesburg becoming one. */
  it('shortens a stay that spanned the removed day by one night', () => {
    const t = trip();
    removeDay(t, 2);

    expect(t.nights[0]).toEqual({ checkInDay: 1, checkOutDay: 2 });
  });

  /** A booked flight is not deleted over a change to the plan, and day 0 is not "after" day 2. */
  it('leaves a leg before the trip alone', () => {
    const t = trip();
    removeDay(t, 2);

    expect(t.transport[0]).toEqual({ day: 0, toDay: 1 });
  });

  it('moves a leg that was after it up', () => {
    const t: ShiftableTrip = { ...trip(), transport: [{ day: 12, toDay: 13 }] };
    removeDay(t, 2);

    expect(t.transport[0]).toEqual({ day: 11, toDay: 12 });
  });

  /**
   * A stay that started on the removed day keeps its number, which now points
   * at the following day. Not deleted, and not silently moved backwards.
   */
  it('keeps a stay that began on the removed day, now meaning the next one', () => {
    const t: ShiftableTrip = { ...trip(), nights: [{ checkInDay: 2, checkOutDay: 4 }] };
    removeDay(t, 2);

    expect(t.nights[0]).toEqual({ checkInDay: 2, checkOutDay: 3 });
  });

  it('leaves an undated stop alone', () => {
    const t = trip();
    removeDay(t, 2);

    expect(t.stops.some((s) => s.day === null)).toBe(true);
  });

  it('removes the last day without touching anything else', () => {
    const t = trip();
    removeDay(t, 4);

    expect(t.days.map((d) => d.day)).toEqual([1, 2, 3]);
    expect(t.nights[0]).toEqual({ checkInDay: 1, checkOutDay: 3 });
  });
});

describe('inserting a day', () => {
  it('makes room by moving that day and everything after it up', () => {
    const t = trip();
    insertDayBefore(t, 3);

    expect(t.days.map((d) => d.day)).toEqual([1, 2, 4, 5]);
    expect(t.stops.map((s) => s.day)).toEqual([1, 2, 2, 4, 5, null]);
  });

  it('creates nothing, so the new day is empty until something is put on it', () => {
    const t = trip();
    const before = t.stops.length;
    insertDayBefore(t, 3);

    expect(t.stops).toHaveLength(before);
    expect(t.days.some((d) => d.day === 3)).toBe(false);
  });

  it('lengthens a stay that spans the new day', () => {
    const t = trip();
    insertDayBefore(t, 2);

    expect(t.nights[0]).toEqual({ checkInDay: 1, checkOutDay: 4 });
  });

  /** Inserting then removing the same day is the identity, which is what makes the pair safe to reach for. */
  it('is undone by removing the day again', () => {
    const t = trip();
    const before = JSON.stringify(t);
    insertDayBefore(t, 3);
    removeDay(t, 3);

    expect(JSON.stringify(t)).toBe(before);
  });
});
