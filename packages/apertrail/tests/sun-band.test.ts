/**
 * The day's light as a band, now that two surfaces draw it: the itinerary's
 * day rows and the photo spot block's sun panel.
 *
 * The two properties that matter are that the band covers the whole day
 * exactly once, and that it stays honest at high latitude. A midsummer day
 * north of the Arctic Circle should look nothing like a midwinter one, and
 * neither should collapse into a single flat colour by accident.
 */
import { describe, expect, it } from 'vitest';
import { sunBandSegments } from '../src/shared/sun-band';

const BERN = { lat: 46.947999, lon: 7.448148 };
const TROMSO = { lat: 69.6492, lon: 18.9553 };

describe('sunBandSegments', () => {
  const date = new Date('2026-06-14T12:00:00Z');

  it('covers the whole day exactly once, with no gaps or overlaps', () => {
    const segments = sunBandSegments(date, BERN, 'Europe/Zurich');
    expect(segments[0].start).toBe(0);
    expect(segments[segments.length - 1].end).toBe(1);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].start).toBe(segments[i - 1].end);
    }
  });

  it('runs night, blue, golden, day and back again', () => {
    const kinds = sunBandSegments(date, BERN, 'Europe/Zurich').map((s) => s.kind);
    expect(kinds).toEqual(['night', 'blue', 'golden', 'day', 'golden', 'blue', 'night']);
  });

  it('puts solar noon inside the day band', () => {
    const segments = sunBandSegments(date, BERN, 'Europe/Zurich');
    const daySegment = segments.find((s) => s.kind === 'day');
    // Solar noon at Bern is about 13:30 local, so a shade past half past.
    expect(daySegment.start).toBeLessThan(13.5 / 24);
    expect(daySegment.end).toBeGreaterThan(13.5 / 24);
  });

  // The whole point of drawing a band: a midsummer trip north of the Arctic
  // Circle should look nothing like a midwinter one. The sun still dips
  // low enough to cross the golden-hour boundary around midnight, which is
  // exactly what the midnight sun looks like and is worth showing rather
  // than flattening into one colour.
  it('has no night at all on a polar day', () => {
    const kinds = sunBandSegments(new Date('2026-06-21T12:00:00Z'), TROMSO, 'Europe/Oslo').map(
      (s) => s.kind
    );
    expect(kinds).not.toContain('night');
    expect(kinds).toContain('day');
  });

  it('has no daylight at all on a polar night', () => {
    const kinds = sunBandSegments(new Date('2026-12-21T12:00:00Z'), TROMSO, 'Europe/Oslo').map(
      (s) => s.kind
    );
    expect(kinds).not.toContain('day');
    expect(kinds).toContain('night');
  });

  it('still covers the whole bar in both polar cases', () => {
    for (const iso of ['2026-06-21T12:00:00Z', '2026-12-21T12:00:00Z']) {
      const segments = sunBandSegments(new Date(iso), TROMSO, 'Europe/Oslo');
      expect(segments[0].start).toBe(0);
      expect(segments[segments.length - 1].end).toBe(1);
    }
  });
});
