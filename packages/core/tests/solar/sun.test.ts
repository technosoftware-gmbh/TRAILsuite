/**
 * Sun times and sun position.
 *
 * Two kinds of check here, and the second is the load-bearing one.
 *
 * The first compares against published tables (timeanddate.de for Bern),
 * which catches a formula that is wrong in a way that still looks
 * internally tidy. The tolerance is 90 seconds: the reference rounds to the
 * minute, and the model does not model the observer's altitude or a real
 * horizon.
 *
 * The second is a property: the sun's computed altitude AT a computed
 * sunrise must equal the sunrise elevation. That is the definition of
 * sunrise, it holds at every latitude and date, and it fails loudly if the
 * time solver and the position solver ever drift apart -- which is exactly
 * the bug a table comparison at one location would miss.
 */
import { describe, expect, it } from 'vitest';
import { lightRelation, SUN_ELEVATIONS, sunPosition, sunTimes } from '../../src/solar/sun.js';
import { present } from '../testing';

const BERN = { lat: 46.947999, lon: 7.448148 };
const REYKJAVIK = { lat: 64.1466, lon: -21.9426 };
const TROMSO = { lat: 69.6492, lon: 18.9553 };

/** Local wall-clock "HH:mm" in a named zone, which is the only form these times are ever read in. */
function at(date: Date | null, timeZone: string): string | null {
  if (!date) return null;
  return date.toLocaleTimeString('de-CH', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function secondsBetween(a: Date, b: Date): number {
  return Math.abs(a.valueOf() - b.valueOf()) / 1000;
}

describe('sunTimes against published tables', () => {
  // Bern, 14 June 2026: sunrise 05:34, sunset 21:26, solar noon 13:30,
  // day length 15:51:33 (timeanddate.de).
  const times = sunTimes(new Date('2026-06-14T12:00:00Z'), BERN.lat, BERN.lon);

  it('puts sunrise, sunset and solar noon within 90 seconds of the published values', () => {
    expect(
      secondsBetween(present(times.sunrise, 'sunrise'), new Date('2026-06-14T03:34:00Z'))
    ).toBeLessThan(90);
    expect(
      secondsBetween(present(times.sunset, 'sunset'), new Date('2026-06-14T19:26:00Z'))
    ).toBeLessThan(90);
    expect(secondsBetween(times.solarNoon, new Date('2026-06-14T11:30:00Z'))).toBeLessThan(90);
  });

  it('gets the day length right to within a minute', () => {
    const hours =
      (present(times.sunset, 'sunset').valueOf() - present(times.sunrise, 'sunrise').valueOf()) /
      3600000;
    expect(hours).toBeCloseTo(15 + 51 / 60 + 33 / 3600, 1);
  });

  /**
   * The instant is the answer and the clock is the caller's.
   *
   * This is the "golden hour is at 03:40" bug written down: the same sunrise
   * reads 05:34 in Bern and 03:34 in UTC, and a caller that renders these in
   * the reader's own zone rather than the place's shows the second one to
   * somebody setting an alarm.
   */
  it('is an instant, which reads as a different clock in a different zone', () => {
    const sunrise = present(times.sunrise, 'sunrise');

    // The hour is the claim and the minute is the model's, so the minute is
    // left loose here: a one-minute refinement is not a broken timezone.
    expect(at(sunrise, 'Europe/Zurich')).toMatch(/^05:3\d$/);
    expect(at(sunrise, 'UTC')).toMatch(/^03:3\d$/);
  });

  it('orders the whole day correctly, from night through noon and back', () => {
    const ordered = [
      times.nightEnd,
      times.goldenHourMorningStart,
      times.sunrise,
      times.dayStart,
      times.solarNoon,
      times.goldenHourEveningStart,
      times.sunset,
      times.blueHourEveningStart,
      times.nightStart,
    ].map((d) => present(d, 'a boundary of the day').valueOf());
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
  });
});

describe('sunTimes and sunPosition agree with each other', () => {
  const cases = [
    ['Bern, midsummer', new Date('2026-06-14T12:00:00Z'), BERN],
    ['Bern, midwinter', new Date('2026-12-21T12:00:00Z'), BERN],
    ['Reykjavik, equinox', new Date('2026-03-20T12:00:00Z'), REYKJAVIK],
    ['southern hemisphere', new Date('2026-09-15T12:00:00Z'), { lat: -33.8688, lon: 151.2093 }],
  ] as const;

  it.each(cases)(
    '%s: the sun really is at the horizon at the computed sunrise',
    (_name, date, place) => {
      const { sunrise, sunset } = sunTimes(date, place.lat, place.lon);
      expect(sunPosition(present(sunrise, 'sunrise'), place.lat, place.lon).altitude).toBeCloseTo(
        SUN_ELEVATIONS.horizon,
        2
      );
      expect(sunPosition(present(sunset, 'sunset'), place.lat, place.lon).altitude).toBeCloseTo(
        SUN_ELEVATIONS.horizon,
        2
      );
    }
  );

  it('is at its daily maximum at solar noon', () => {
    const { solarNoon } = sunTimes(new Date('2026-06-14T12:00:00Z'), BERN.lat, BERN.lon);
    const noonAltitude = sunPosition(solarNoon, BERN.lat, BERN.lon).altitude;
    for (const offsetMinutes of [-40, -10, 10, 40]) {
      const other = new Date(solarNoon.valueOf() + offsetMinutes * 60000);
      expect(sunPosition(other, BERN.lat, BERN.lon).altitude).toBeLessThan(noonAltitude);
    }
  });

  it('puts the midsummer sun in the northeast at sunrise and the northwest at sunset', () => {
    const { sunrise, sunset } = sunTimes(new Date('2026-06-14T12:00:00Z'), BERN.lat, BERN.lon);
    expect(sunPosition(present(sunrise, 'sunrise'), BERN.lat, BERN.lon).azimuth).toBeCloseTo(
      53,
      -1
    );
    expect(sunPosition(present(sunset, 'sunset'), BERN.lat, BERN.lon).azimuth).toBeCloseTo(307, -1);
  });
});

describe('polar day', () => {
  // Not an error state. In Tromsø in June the sun does not set, and a
  // golden-hour chip there should say so rather than invent a time.
  it('reports null rather than a made-up time when the sun never sets', () => {
    const times = sunTimes(new Date('2026-06-21T12:00:00Z'), TROMSO.lat, TROMSO.lon);
    expect(times.sunrise).toBeNull();
    expect(times.sunset).toBeNull();
    expect(times.solarNoon).toBeInstanceOf(Date);
  });

  it('still gives a solar noon, because the sun is up and somewhere', () => {
    const times = sunTimes(new Date('2026-06-21T12:00:00Z'), TROMSO.lat, TROMSO.lon);
    const noon = times.solarNoon;
    expect(noon).not.toBeNull();
    // And the day is bounded even where the night is not: the sun still
    // crosses the golden-hour elevation twice, which is why people shoot
    // Lofoten in June.
    expect(times.dayStart).toBeInstanceOf(Date);
    expect(times.goldenHourEveningStart).toBeInstanceOf(Date);
  });
});

describe('lightRelation', () => {
  /**
   * The direction is what you shoot TOWARD, so a sun sitting in that
   * direction is behind the SUBJECT. Inverting this produces a badge that
   * is wrong in exactly the situations somebody would rely on it.
   */
  it('calls the sun in the shooting direction back lit', () => {
    expect(lightRelation(215, 215)).toBe('back');
    expect(lightRelation(180, 215)).toBe('back');
  });

  it('calls the sun behind the photographer front lit', () => {
    expect(lightRelation(35, 215)).toBe('front');
    expect(lightRelation(60, 215)).toBe('front');
  });

  it('calls everything in between side lit', () => {
    expect(lightRelation(125, 215)).toBe('side');
    expect(lightRelation(305, 215)).toBe('side');
  });

  it('handles the wrap at north without a discontinuity', () => {
    expect(lightRelation(350, 10)).toBe('back');
    expect(lightRelation(190, 10)).toBe('front');
  });
});
