/**
 * Distance and bearing between two coordinate pairs. Checked against real
 * places with independently known answers rather than against whatever the
 * implementation happens to return.
 */
import { describe, expect, it } from 'vitest';
import {
  bearing,
  compassPoint,
  distanceKm,
  formatDistance,
  parseGeoPoint,
} from '../../src/geo/points.js';

// Two real places a few kilometres apart: the castle in Neuchâtel and the
// Pavillon des Bains down the west shore of the lake.
const CHATEAU = { lat: 46.9895, lon: 6.9243 };
const PAVILLON = { lat: 46.9161, lon: 6.8419 };

describe('parseGeoPoint', () => {
  it('turns the stored string pair into numbers', () => {
    expect(parseGeoPoint(['46.9899', '6.9293'])).toEqual({ lat: 46.9899, lon: 6.9293 });
  });

  it('reads a missing or unparseable pair as null', () => {
    expect(parseGeoPoint(null)).toBeNull();
    expect(parseGeoPoint(['north', '6.9'])).toBeNull();
    expect(parseGeoPoint(['', ''])).toBeNull();
  });

  // A latitude of 91 means the pair was pasted wrong or the halves were
  // swapped. Clamping it would put a motif somewhere nobody has stood.
  it('rejects an out-of-range value rather than clamping it', () => {
    expect(parseGeoPoint(['91', '6.9'])).toBeNull();
    expect(parseGeoPoint(['46.9', '181'])).toBeNull();
  });
});

describe('distanceKm', () => {
  it('measures the two Neuchâtel motifs about 10 km apart', () => {
    expect(distanceKm(CHATEAU, PAVILLON)).toBeCloseTo(10.28, 1);
  });

  it('is zero for a point against itself and symmetric between two points', () => {
    expect(distanceKm(CHATEAU, CHATEAU)).toBe(0);
    expect(distanceKm(CHATEAU, PAVILLON)).toBeCloseTo(distanceKm(PAVILLON, CHATEAU), 9);
  });

  it('gets a long known distance right, so the formula is not merely locally plausible', () => {
    // Zurich to New York, roughly 6300 km great-circle.
    const zurich = { lat: 47.3769, lon: 8.5417 };
    const newYork = { lat: 40.7128, lon: -74.006 };
    expect(distanceKm(zurich, newYork)).toBeGreaterThan(6200);
    expect(distanceKm(zurich, newYork)).toBeLessThan(6400);
  });
});

describe('bearing', () => {
  it('points southwest from the castle to the Pavillon', () => {
    expect(bearing(CHATEAU, PAVILLON)).toBeCloseTo(217.5, 0);
    expect(compassPoint(bearing(CHATEAU, PAVILLON))).toBe('SW');
  });

  it('reads the cardinal directions off a small offset', () => {
    const origin = { lat: 47, lon: 8 };
    expect(compassPoint(bearing(origin, { lat: 47.1, lon: 8 }))).toBe('N');
    expect(compassPoint(bearing(origin, { lat: 46.9, lon: 8 }))).toBe('S');
    expect(compassPoint(bearing(origin, { lat: 47, lon: 8.1 }))).toBe('E');
    expect(compassPoint(bearing(origin, { lat: 47, lon: 7.9 }))).toBe('W');
  });
});

describe('compassPoint', () => {
  it('rounds to the nearest of the sixteen points', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(11)).toBe('N');
    expect(compassPoint(12)).toBe('NNE');
    expect(compassPoint(215)).toBe('SW');
  });

  // 350 degrees is north, not "north-northwest and a bit" -- the wrap has
  // to happen before the rounding, or the last 11 degrees of the circle
  // fall off the end of the table.
  it('wraps past 360 back to north', () => {
    expect(compassPoint(350)).toBe('N');
    expect(compassPoint(360)).toBe('N');
    expect(compassPoint(370)).toBe('N');
    expect(compassPoint(-10)).toBe('N');
  });
});

describe('formatDistance', () => {
  it('says metres below a kilometre and drops the decimal above ten', () => {
    expect(formatDistance(0.38)).toBe('380 m');
    expect(formatDistance(8.94)).toBe('8.9 km');
    expect(formatDistance(23.6)).toBe('24 km');
  });
});
