/**
 * Reading a calendar's clock in the vault's zone.
 *
 * The bug this exists for wrote 06:00 into a Zurich day note for an eight
 * o'clock meeting, because the importer copied the digits out of the file and
 * never looked at the `Z`. So the cases that matter are the ones where copying
 * the digits gives a plausible answer: an hour or two out reads as an early
 * meeting rather than as a fault.
 *
 * The suite runs pinned to Europe/Zurich, but nothing here depends on that:
 * every zone is named in the call.
 */
import { describe, expect, it } from 'vitest';
import { inZone, movesInZone } from '../src/calendar/zones';
import type { IcsMoment } from '../src/calendar/ics';

function utc(date: string, time: string | null): IcsMoment {
  return { date, time, zone: null, utc: true };
}

function inTz(zone: string, date: string, time: string | null): IcsMoment {
  return { date, time, zone, utc: false };
}

function floating(date: string, time: string | null): IcsMoment {
  return { date, time, zone: null, utc: false };
}

const ZURICH = 'Europe/Zurich';

describe('a UTC instant', () => {
  it('gains two hours in summer', () => {
    // The reported case, exactly: 06:00Z in the file, eight o'clock in the day.
    expect(inZone(utc('2026-09-11', '06:00'), ZURICH)).toEqual({
      date: '2026-09-11',
      time: '08:00',
    });
  });

  it('gains one hour in winter, so the error is not a constant', () => {
    // Why it was hard to see. A fixed two hours would have shown up as an
    // offset; an error that changes with the season looks like bad data.
    expect(inZone(utc('2026-01-15', '07:00'), ZURICH)).toEqual({
      date: '2026-01-15',
      time: '08:00',
    });
  });

  it('moves a late event onto the next day', () => {
    // The worse half of the bug: not the wrong time in the right note, but the
    // right time in a note nobody will look at for it.
    expect(inZone(utc('2026-09-11', '23:00'), ZURICH)).toEqual({
      date: '2026-09-12',
      time: '01:00',
    });
  });

  it('moves an early event onto the previous day', () => {
    expect(inZone(utc('2026-09-12', '01:30'), 'America/New_York')).toEqual({
      date: '2026-09-11',
      time: '21:30',
    });
  });
});

describe('a time stated in another zone', () => {
  it('is read as that zone wall clock and written as ours', () => {
    expect(inZone(inTz('America/New_York', '2026-09-11', '08:00'), ZURICH)).toEqual({
      date: '2026-09-11',
      time: '14:00',
    });
  });

  it('is left alone when the zone is our own', () => {
    // The common case in a real export, and the reason a third of a calendar
    // came out right while the rest did not.
    expect(inZone(inTz(ZURICH, '2026-09-11', '08:00'), ZURICH)).toEqual({
      date: '2026-09-11',
      time: '08:00',
    });
  });

  it('is left alone when the zone merely agrees with ours', () => {
    // Madrid and Berlin keep the same clock as Zurich, which is why 170 events
    // in the reported export were right by luck rather than by reading.
    expect(inZone(inTz('Europe/Madrid', '2026-09-11', '08:00'), ZURICH).time).toBe('08:00');
    expect(inZone(inTz('Europe/Berlin', '2026-01-15', '08:00'), ZURICH).time).toBe('08:00');
  });
});

describe('what is deliberately not converted', () => {
  it('leaves an all-day date alone, rather than moving a birthday over midnight', () => {
    expect(inZone(utc('2026-09-11', null), ZURICH)).toEqual({ date: '2026-09-11', time: null });
  });

  it('leaves a floating time alone, because it already means here', () => {
    expect(inZone(floating('2026-09-11', '08:00'), ZURICH)).toEqual({
      date: '2026-09-11',
      time: '08:00',
    });
  });

  it('leaves a zone name nothing knows alone rather than failing the import', () => {
    // One meeting loses its precision. The alternative is three thousand
    // events not arriving because one of them named a zone that does not exist.
    expect(inZone(inTz('Mars/Olympus_Mons', '2026-09-11', '08:00'), ZURICH).time).toBe('08:00');
  });

  it('leaves everything alone when the caller states no zone', () => {
    expect(inZone(utc('2026-09-11', '06:00'), '  ').time).toBe('06:00');
  });

  it('leaves a malformed clock alone', () => {
    expect(inZone(utc('not-a-day', '06:00'), ZURICH).date).toBe('not-a-day');
  });
});

describe('daylight saving, on both edges', () => {
  it('reads the hour before and after the spring change', () => {
    // Europe/Zurich springs forward at 02:00 local on 29 March 2026, which is
    // 01:00 UTC. One minute either side of it, and the offsets differ.
    expect(inZone(utc('2026-03-29', '00:59'), ZURICH).time).toBe('01:59');
    expect(inZone(utc('2026-03-29', '01:01'), ZURICH).time).toBe('03:01');
  });

  it('reads the hour before and after the autumn change', () => {
    // Back at 03:00 local on 25 October 2026, which is 01:00 UTC.
    expect(inZone(utc('2026-10-25', '00:59'), ZURICH).time).toBe('02:59');
    expect(inZone(utc('2026-10-25', '01:01'), ZURICH).time).toBe('02:01');
  });

  it('resolves a local clock that never happened to the hour after it', () => {
    // 02:30 on the spring morning does not exist in Zurich. Reading it in a
    // zone an hour behind proves the correction pass runs: a single-pass guess
    // would land an hour out.
    expect(inZone(inTz(ZURICH, '2026-03-29', '02:30'), 'Europe/London')).toEqual({
      date: '2026-03-29',
      time: '02:30',
    });
  });

  it('resolves a local clock that happened twice to the second of them', () => {
    // 02:30 on the autumn morning happens twice in Zurich, at 00:30 UTC on
    // summer time and again at 01:30 UTC on standard time. The second is what
    // the correction pass lands on, and it is pinned here because it is a
    // choice the arithmetic makes rather than one anybody argued for. Only a
    // `TZID` time inside the repeated hour can reach it; a `Z` time names an
    // instant and is never ambiguous.
    expect(inZone(inTz(ZURICH, '2026-10-25', '02:30'), 'UTC')).toEqual({
      date: '2026-10-25',
      time: '01:30',
    });
  });

  it('crosses a year end without losing the day', () => {
    expect(inZone(utc('2026-12-31', '23:30'), ZURICH)).toEqual({
      date: '2027-01-01',
      time: '00:30',
    });
  });
});

describe('movesInZone', () => {
  it('is true for the times that were being written wrongly', () => {
    expect(movesInZone(utc('2026-09-11', '06:00'), ZURICH)).toBe(true);
    expect(movesInZone(inTz('America/New_York', '2026-09-11', '08:00'), ZURICH)).toBe(true);
  });

  it('is false for everything that was already right', () => {
    expect(movesInZone(inTz(ZURICH, '2026-09-11', '08:00'), ZURICH)).toBe(false);
    expect(movesInZone(floating('2026-09-11', '08:00'), ZURICH)).toBe(false);
    expect(movesInZone(utc('2026-09-11', null), ZURICH)).toBe(false);
  });
});
