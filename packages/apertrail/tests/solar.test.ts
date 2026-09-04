/**
 * What this plugin means by each of its nine light windows.
 *
 * **The sun arithmetic is not tested here any more**, because it is not here
 * any more: `sunTimes`, `sunPosition` and `lightRelation` moved to
 * `trail-core`, where they are checked against published tables and against
 * their own definitions rather than against what this plugin does with them.
 *
 * What is left is the mapping, which is this plugin's opinion rather than the
 * sun's. Every assertion ties a window to a boundary rather than to a clock
 * string, so a one-minute refinement of the model in the core does not read
 * here as a broken window.
 */
import { describe, expect, it } from 'vitest';
import { sunTimes } from 'trail-core';
import { lightWindowRange } from '../src/places/solar';

const BERN = { lat: 46.947999, lon: 7.448148 };
const TROMSO = { lat: 69.6492, lon: 18.9553 };

describe('lightWindowRange', () => {
  const date = new Date('2026-06-14T12:00:00Z');
  const range = (w: Parameters<typeof lightWindowRange>[0]) =>
    lightWindowRange(w, date, BERN.lat, BERN.lon);

  it('gives the blue hour as exactly the span from night to golden hour', () => {
    const times = sunTimes(date, BERN.lat, BERN.lon);
    const blue = range('blue-hour-morning');
    expect(blue.start.valueOf()).toBe(times.nightEnd.valueOf());
    expect(blue.end.valueOf()).toBe(times.goldenHourMorningStart.valueOf());
  });

  // Sunrise is a moment, not an hour. Padding it by some invented number of
  // minutes would be the plugin making up a fact.
  it('gives sunrise as an instant rather than a padded window', () => {
    const sunrise = range('sunrise');
    expect(sunrise.start.valueOf()).toBe(sunrise.end.valueOf());
  });

  // A sky condition, not a time of day.
  it('gives overcast no window at all', () => {
    expect(range('overcast')).toBeNull();
  });

  it('leaves night open-ended, since it runs into the next morning', () => {
    const times = sunTimes(date, BERN.lat, BERN.lon);
    const night = range('night');
    expect(night.end).toBeNull();
    expect(night.start.valueOf()).toBe(times.nightStart.valueOf());
  });

  /**
   * Polar day is not an error state.
   *
   * In Tromsø in June the sun does not set, so a golden-hour chip there has no
   * clock to show and must say nothing rather than invent a time. The core
   * returns null for the boundary; the job here is to pass that through rather
   * than to throw on it.
   */
  it('resolves to null where the sun never sets, rather than throwing', () => {
    expect(
      lightWindowRange('sunset', new Date('2026-06-21T12:00:00Z'), TROMSO.lat, TROMSO.lon)
    ).toBeNull();
  });
});
