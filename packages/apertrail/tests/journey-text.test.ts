/**
 * A leg reads like a flight card, because that is what everybody has already
 * learnt to read.
 *
 * `20:30 - 10:00 +1` says the overnight in the one glyph an airline, a railway
 * and a booking confirmation all use for it. What it replaced named both ends
 * -- "Tag 0 -> Tag 1" -- which is the same fact twice, in a vocabulary nobody
 * uses outside this plugin. Reported as exactly that: "usually a flight card
 * will show the arrival at +1Day".
 *
 * A stay is not built here and keeps its span: a hotel confirmation says two
 * dates because a stay IS the two dates, where a flight is a departure with an
 * arrival hanging off it.
 */
import { describe, expect, it } from 'vitest';
import { legClock, legWhen, LegSpan } from '../src/trips/journey-text';
import { dayOffset } from '../src/trips/relative-days';

const DEPARTURE = '2026-11-02';

function leg(over: Partial<LegSpan> = {}): LegSpan {
  return { day: null, toDay: null, from: null, to: null, ...over };
}

/** The overnight flight this was written for: leaves the evening before day one. */
const REDEYE = leg({ day: 0, toDay: 1, from: '20:30', to: '10:00' });

describe('how many days later the arrival is', () => {
  it('is one for a flight that lands the next day', () => {
    expect(dayOffset({ day: 0, value: '20:30' }, { day: 1, value: '10:00' }, null)).toBe(1);
  });

  /** Zero is a real answer and not the same as null: one has nothing to show, the other nothing to say. */
  it('is zero for a flight that lands the same day', () => {
    expect(dayOffset({ day: 3, value: '09:00' }, { day: 3, value: '13:00' }, null)).toBe(0);
  });

  it('is nothing when the leg names no arrival day', () => {
    expect(dayOffset({ day: 0, value: '20:30' }, { day: null, value: null }, null)).toBeNull();
  });

  it('counts from the dates once the trip has them', () => {
    expect(
      dayOffset(
        { day: null, value: '2026-11-01T20:30' },
        { day: null, value: '2026-11-02T10:00' },
        null
      )
    ).toBe(1);
  });
});

describe('the clock on a leg', () => {
  it('marks an arrival on the next day', () => {
    expect(legClock(REDEYE, null)).toBe('20:30 - 10:00 +1');
  });

  it('marks nothing when it lands the same day', () => {
    expect(legClock(leg({ day: 3, toDay: 3, from: '09:00', to: '13:00' }), null)).toBe(
      '09:00 - 13:00'
    );
  });

  /** So the marker means something wherever it appears, rather than being decoration. */
  it('marks nothing when the leg says only one end', () => {
    expect(legClock(leg({ day: 0, from: '20:30' }), null)).toContain('20:30');
    expect(legClock(leg({ day: 0, from: '20:30' }), null)).not.toContain('+');
  });

  it('says nothing at all for a leg with no times', () => {
    expect(legClock(leg({ day: 0, toDay: 1 }), null)).toBeNull();
  });

  it('reads an absolute leg the same way', () => {
    expect(legClock(leg({ from: '2026-11-01T20:30', to: '2026-11-02T10:00' }), null)).toBe(
      '20:30 - 10:00 +1'
    );
  });
});

describe('when a leg leaves', () => {
  /** The departure only. The arrival is the +1, and saying both was the thing that read wrong. */
  it('is the day it leaves, not a span', () => {
    expect(legWhen(REDEYE, null)).toBe('Day 0');
    expect(legWhen(REDEYE, null)).not.toContain('Day 1');
    expect(legWhen(REDEYE, null)).not.toContain('→');
  });

  /** Day 0 of a trip departing on 2 November is 1 November, whatever the locale writes that as. */
  it('is the date once the trip has a departure', () => {
    const when = legWhen(REDEYE, DEPARTURE) ?? '';

    expect(when).toContain('November');
    expect(when).toContain('1');
    expect(when).not.toContain('Day');
  });

  it('says nothing for a leg that names no day at all', () => {
    expect(legWhen(leg({ from: '20:30' }), null)).toBeNull();
  });
});
