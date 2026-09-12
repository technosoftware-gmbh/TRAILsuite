/**
 * Where the sun is, and when. Pure arithmetic: no network, no API key, no clock
 * of its own.
 *
 * **This is the part a printed location guide cannot do.** A book can say the
 * Pavillon des Bains wants the blue hour; only a calculation says that on 14
 * June that means 04:58 to 05:14, and that the sun will come up behind the
 * subject rather than behind you.
 *
 * Standard NOAA/Meeus solar position, in the formulation photographers' tools
 * generally use, with the transit and the rise/set solves both iterated rather
 * than approximated by a truncated series. Agrees with published tables to
 * within a minute at mid-latitudes, and within about two at 64 degrees north
 * around an equinox, which is the hardest case there is. Both are far inside
 * the error of a coordinate pasted off a map view, and inside the error of the
 * horizon assumption below.
 *
 * **Two limitations to state rather than hide**, because both matter in the
 * field and neither is fixable here:
 *
 *  1. This is geometry, not weather. It knows where the sun is, not whether
 *     you will see it.
 *  2. It assumes a flat horizon. A spot in a valley loses its golden hour to
 *     the ridge line, and no amount of arithmetic knows that. Somewhere in the
 *     consuming app, a person writes "the sun clears the ridge about 40 minutes
 *     after sunrise", and that note beats this file.
 *
 * A caller that renders any of this owes a person both sentences on screen.
 *
 * **What deliberately did not come with it.** APERtrail maps its own light
 * window vocabulary onto these times, and that mapping stayed in APERtrail:
 * which words a photo spot may use for its light is that app's schema, and
 * product schemas do not move here. `SUN_ELEVATIONS` and `sunTimes` are the
 * boundaries; naming the spans between them is the caller's.
 */
const RAD = Math.PI / 180;
const J2000 = 2451545;
const J1970 = 2440588;
/** Leap-second-free fractional-day offset used by the transit approximation. */
const J0 = 0.0009;
const DAY_MS = 86400000;
/**
 * Delta-T (TT minus UT) in days, about 69 seconds this decade.
 *
 * The position series are defined on Terrestrial Time while the day count
 * comes from a UTC clock, and the two have drifted apart since 2000. It is
 * a small correction (roughly ten seconds on a sunrise), and it is a
 * constant rather than a model because it changes by under a second a year
 * and nothing here needs more than that.
 */
const DELTA_T_DAYS = 69 / 86400;

/** Obliquity of the ecliptic. */
const OBLIQUITY = 23.4397 * RAD;
/** Longitude of perihelion. */
const PERIHELION = 102.9372 * RAD;

/**
 * The sun elevations that bound each light window, in degrees.
 *
 * Not settings, and not the caller's to pass in. Every screen derived from
 * these has to agree on the same boundaries or two of them contradict each
 * other in the same window, and a vault that disagreed by half a degree would
 * gain nothing it could use.
 *
 * HORIZON is -0.833 rather than 0 because the sun is already fully below
 * the geometric horizon when you still see it: refraction lifts the disc
 * by about 34 arcminutes and the disc's own radius adds another 16.
 */
export const SUN_ELEVATIONS = {
  nightEdge: -6,
  blueGolden: -4,
  horizon: -0.833,
  goldenDay: 6,
} as const;

function toJulian(date: Date): number {
  return date.valueOf() / DAY_MS - 0.5 + J1970;
}

function fromJulian(julian: number): Date {
  return new Date((julian + 0.5 - J1970) * DAY_MS);
}

function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

function solarMeanAnomaly(days: number): number {
  return RAD * (357.5291 + 0.98560028 * days);
}

/** Apparent ecliptic longitude of the sun. */
function eclipticLongitude(meanAnomaly: number): number {
  const center =
    RAD *
    (1.9148 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly) +
      0.0003 * Math.sin(3 * meanAnomaly));
  return meanAnomaly + center + PERIHELION + Math.PI;
}

function declination(eclipticLon: number): number {
  return Math.asin(Math.sin(OBLIQUITY) * Math.sin(eclipticLon));
}

function rightAscension(eclipticLon: number): number {
  return Math.atan2(Math.sin(eclipticLon) * Math.cos(OBLIQUITY), Math.cos(eclipticLon));
}

function siderealTime(days: number, westLon: number): number {
  return RAD * (280.16 + 360.9856235 * days) - westLon;
}

export interface SunPosition {
  /** Degrees above the horizon; negative when the sun is down. */
  altitude: number;
  /** Degrees clockwise from north, so it compares directly against a bearing. */
  azimuth: number;
}

/**
 * Where the sun is at one instant.
 *
 * Azimuth is returned clockwise from NORTH, not from south as the underlying
 * formula produces it, so it lives on the same scale as `bearing` and
 * `compassPoint` in this package's geo module, and as a direction somebody
 * wrote in a note. A mismatch there is a 180-degree error that looks plausible
 * in every screenshot.
 */
export function sunPosition(instant: Date, lat: number, lon: number): SunPosition {
  const westLon = -lon * RAD;
  const phi = lat * RAD;
  const days = toDays(instant);

  const eclipticLon = eclipticLongitude(solarMeanAnomaly(days + DELTA_T_DAYS));
  const dec = declination(eclipticLon);
  const hourAngle = siderealTime(days, westLon) - rightAscension(eclipticLon);

  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle)
  );
  const azimuthFromSouth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)
  );

  return {
    altitude: altitude / RAD,
    azimuth: (azimuthFromSouth / RAD + 180 + 360) % 360,
  };
}

function julianCycle(days: number, westLon: number): number {
  return Math.round(days - J0 - westLon / (2 * Math.PI));
}

function approxTransit(hourAngle: number, westLon: number, cycle: number): number {
  return J0 + (hourAngle + westLon) / (2 * Math.PI) + cycle;
}

/** Wrap an angle into (-PI, PI]. */
function wrapPi(angle: number): number {
  return angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI));
}

/**
 * Solar noon, refined until the sun's local hour angle is zero (Meeus
 * ch. 15).
 *
 * The usual shortcut is a two-term series (0.0053 sin M - 0.0069 sin 2L)
 * that approximates the equation of time. It was what this function did
 * first, and it put solar noon about 1.8 minutes late all year, which
 * carried straight into every sunrise and every golden-hour chip. Three
 * iterations of the real thing cost nothing measurable and remove the bias
 * entirely: each step moves the estimate by the hour angle it is still
 * off, and the sidereal excess and the sun's own motion cancel to one
 * solar day, so dH/dt is 2*PI per day.
 *
 * Deliberately not corrected for delta-T (TT minus UT, about 69 seconds).
 * At the sun's rate of motion that is a third of a second of position,
 * which is three orders of magnitude below the precision of a coordinate
 * pasted off a map view.
 */
function solarTransit(approxDays: number, westLon: number): number {
  let dt = approxDays;
  for (let i = 0; i < 3; i++) {
    const eclipticLon = eclipticLongitude(solarMeanAnomaly(dt + DELTA_T_DAYS));
    const hourAngle = wrapPi(siderealTime(dt, westLon) - rightAscension(eclipticLon));
    dt -= hourAngle / (2 * Math.PI);
  }
  return dt;
}

/**
 * The hour angle at which the sun sits at elevation `h`, or null when it
 * never does on that day. Null is the polar case, and it is a real answer
 * rather than an error: in Tromsø in June the sun does not set, and a
 * golden-hour chip there should say so instead of inventing a time.
 */
function hourAngleAt(h: number, phi: number, dec: number): number | null {
  const cosH =
    (Math.sin(h * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosH > 1 || cosH < -1) return null;
  return Math.acos(cosH);
}

export interface SunTimes {
  solarNoon: Date;
  /** Sun crossing -6 degrees, rising. Start of the morning blue hour. */
  nightEnd: Date | null;
  /** Sun crossing -4 degrees, rising. Blue hour becomes golden hour. */
  goldenHourMorningStart: Date | null;
  sunrise: Date | null;
  /** Sun crossing +6 degrees, rising. Golden hour becomes plain daylight. */
  dayStart: Date | null;
  /** Sun crossing +6 degrees, setting. */
  goldenHourEveningStart: Date | null;
  sunset: Date | null;
  /** Sun crossing -4 degrees, setting. Golden hour becomes blue hour. */
  blueHourEveningStart: Date | null;
  /** Sun crossing -6 degrees, setting. Night. */
  nightStart: Date | null;
}

/**
 * Every boundary of the day's light, for one date at one place.
 *
 * `date` is used only for the day it falls in; the clock time on it is
 * ignored. Everything comes back as a real instant, so the caller decides
 * which timezone to render it in, and that decision is not optional: rendering
 * a Norwegian sunrise in the reader's own clock is the bug that shows up as
 * "golden hour is at 03:40" and nothing else.
 */
export function sunTimes(date: Date, lat: number, lon: number): SunTimes {
  const westLon = -lon * RAD;
  const phi = lat * RAD;

  // Anchored to the input date's UTC solar day whatever clock time it
  // carries, so an early-morning Date does not return the previous day's
  // events -- a footgun worth designing out rather than documenting.
  const days = Math.round(toDays(date));
  const cycle = julianCycle(days, westLon);
  const noonDays = solarTransit(approxTransit(0, westLon, cycle), westLon);
  const noonJulian = J2000 + noonDays;
  const dec = declination(eclipticLongitude(solarMeanAnomaly(noonDays + DELTA_T_DAYS)));

  /**
   * Rise and set are the noon reflections of one hour-angle solve, then
   * refined once against the altitude they actually reach (Meeus 15.2).
   * The reflection alone is exact only for a sun whose declination does
   * not move during the day; near the equinoxes it moves fastest, and that
   * is where the uncorrected version drifts by half a minute.
   */
  const refine = (h: number, guess: number): number => {
    let days = guess;
    // Two passes. One removes most of the error; the second matters at high
    // latitudes near an equinox, where the declination moves fastest and a
    // single correction still left Reykjavik two minutes out.
    for (let i = 0; i < 2; i++) {
      const eclipticLon = eclipticLongitude(solarMeanAnomaly(days + DELTA_T_DAYS));
      const decAt = declination(eclipticLon);
      const hourAngle = wrapPi(siderealTime(days, westLon) - rightAscension(eclipticLon));
      const altitude =
        Math.asin(
          Math.sin(phi) * Math.sin(decAt) + Math.cos(phi) * Math.cos(decAt) * Math.cos(hourAngle)
        ) / RAD;
      const slope = Math.cos(phi) * Math.cos(decAt) * Math.sin(hourAngle);
      // Grazing the horizon: the correction divides by a vanishing slope
      // and would throw the estimate across the sky. The unrefined guess is
      // the better answer there.
      if (Math.abs(slope) < 1e-6) break;
      days += ((altitude - h) * RAD) / (2 * Math.PI * slope);
    }
    return days;
  };

  const pair = (h: number): [Date | null, Date | null] => {
    const hourAngle = hourAngleAt(h, phi, dec);
    if (hourAngle === null) return [null, null];
    const offset = hourAngle / (2 * Math.PI);
    return [
      fromJulian(J2000 + refine(h, noonDays - offset)),
      fromJulian(J2000 + refine(h, noonDays + offset)),
    ];
  };

  const [nightEnd, nightStart] = pair(SUN_ELEVATIONS.nightEdge);
  const [goldenHourMorningStart, blueHourEveningStart] = pair(SUN_ELEVATIONS.blueGolden);
  const [sunrise, sunset] = pair(SUN_ELEVATIONS.horizon);
  const [dayStart, goldenHourEveningStart] = pair(SUN_ELEVATIONS.goldenDay);

  return {
    solarNoon: fromJulian(noonJulian),
    nightEnd,
    goldenHourMorningStart,
    sunrise,
    dayStart,
    goldenHourEveningStart,
    sunset,
    blueHourEveningStart,
    nightStart,
  };
}

/** Where the sun sits relative to what the camera is pointed at. */
export type LightRelation = 'front' | 'side' | 'back';

/**
 * Front lit, side lit or back lit, from the sun's azimuth and the bearing
 * the camera points along.
 *
 * Three buckets, not more: the inputs are a coordinate pasted off a map and
 * a bearing somebody estimated, and a fourth bucket would imply a precision
 * neither of them has.
 *
 * Note which way round these are. `direction` is what you shoot TOWARD, so
 * a sun sitting in that direction is behind the subject and the frame is
 * BACK lit. The sun behind the photographer is front lit. Getting this
 * inverted produces a badge that is wrong in exactly the situations
 * somebody would rely on it.
 */
export function lightRelation(sunAzimuth: number, direction: number): LightRelation {
  // The angle between where the sun is and where the camera points, folded
  // into [0, 180]. Zero means the sun sits in the frame.
  const delta = Math.abs(((sunAzimuth - direction + 540) % 360) - 180);
  if (delta < 45) return 'back';
  if (delta > 135) return 'front';
  return 'side';
}
