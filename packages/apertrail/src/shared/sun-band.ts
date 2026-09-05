/**
 * A day's light at a place, as contiguous bands across the 24 hours.
 *
 * Not a trip concept and not an Obsidian one: it is a function of a place,
 * a date and this plugin's own light vocabulary, which is why it sits in
 * `shared/` and is imported by both the itinerary's day rows and the photo
 * spot block's sun panel. It lived in `trips/` while the itinerary was the
 * only thing drawing it.
 *
 * The boundaries themselves come from trail-core: when the sun crosses a
 * given elevation is a fact about the sun. What counts as "golden" between
 * two of those crossings is product logic and is here.
 */
import { GeoPoint, SUN_ELEVATIONS, sunPosition, sunTimes } from '@technosoftware/trail-core';

/** The bands of a day's light, in order, as fractions of the 24 hours. */
export type SunBandKind = 'night' | 'blue' | 'golden' | 'day';

export interface SunBandSegment {
  kind: SunBandKind;
  /** 0 to 1 across the local day. */
  start: number;
  end: number;
}

/**
 * The day's light as contiguous segments covering midnight to midnight.
 *
 * Built from the boundary times rather than by sampling: sampling would
 * need a resolution, and every resolution is either too coarse at the
 * equinox or wasteful the rest of the year.
 *
 * Above the Arctic Circle the bar stays honest rather than collapsing: at
 * midsummer the sun still dips low enough around midnight to cross the
 * golden-hour boundary, which is what the midnight sun actually looks like
 * and is worth drawing. Only a day with no crossings at all comes back as
 * one flat segment.
 */
export function sunBandSegments(date: Date, point: GeoPoint, timeZone?: string): SunBandSegment[] {
  const times = sunTimes(date, point.lat, point.lon);
  const dayStartMs = startOfLocalDay(date, timeZone).valueOf();

  const at = (instant: Date | null): number | null => {
    if (!instant) return null;
    const fraction = (instant.valueOf() - dayStartMs) / 86400000;
    return Math.min(1, Math.max(0, fraction));
  };

  // The band the day OPENS in, read off the sun's actual altitude at local
  // midnight rather than assumed to be night. Above the Arctic Circle in
  // June midnight is broad daylight, and seeding a night band there put a
  // black stripe at the left edge of every midnight-sun day.
  const openingKind = bandKindForAltitude(
    sunPosition(new Date(dayStartMs), point.lat, point.lon).altitude
  );

  const boundaries: [SunBandKind, number | null][] = [
    [openingKind, 0],
    ['blue', at(times.nightEnd)],
    ['golden', at(times.goldenHourMorningStart)],
    ['day', at(times.dayStart)],
    ['golden', at(times.goldenHourEveningStart)],
    ['blue', at(times.blueHourEveningStart)],
    ['night', at(times.nightStart)],
  ];

  const points = boundaries.filter((entry): entry is [SunBandKind, number] => entry[1] !== null);
  // No crossings at all: the sun spent the whole day in one band, and the
  // altitude at midnight already told us which.
  if (points.length <= 1) return [{ kind: openingKind, start: 0, end: 1 }];

  const segments: SunBandSegment[] = [];
  for (let i = 0; i < points.length; i++) {
    const start = points[i][1];
    const end = i + 1 < points.length ? points[i + 1][1] : 1;
    if (end > start) segments.push({ kind: points[i][0], start, end });
  }
  return segments;
}

/** Which band an altitude falls in, using the same boundaries the light windows do. */
function bandKindForAltitude(altitude: number): SunBandKind {
  if (altitude >= SUN_ELEVATIONS.goldenDay) return 'day';
  if (altitude >= SUN_ELEVATIONS.blueGolden) return 'golden';
  if (altitude >= SUN_ELEVATIONS.nightEdge) return 'blue';
  return 'night';
}

/**
 * Local midnight of the day `date` falls in, in the given zone.
 *
 * Exported because anything drawn against the band has to agree with it
 * about where the day starts. The sun panel's hour ticks are placed from
 * here, so a spot in another zone gets ticks in ITS clock rather than in
 * the reader's.
 */
export function startOfLocalDay(date: Date, timeZone?: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone?.trim() || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const minutesIntoDay = get('hour') * 60 + get('minute');
  return new Date(date.valueOf() - minutesIntoDay * 60000);
}
