/**
 * Distance and bearing between two coordinate pairs. Pure arithmetic: no
 * network, no map data, no projection library.
 *
 * **Here rather than in APERtrail, because none of it is APERtrail's.** The
 * distance between two coordinates is the same distance whatever is being
 * measured, and nothing below has ever heard of a photo spot or a trip. A
 * product decides which places to compare and what to call the answer on
 * screen; the arithmetic those decisions are made against is not the product's
 * to own, and holding it here is what keeps a schema from growing into a
 * formula. `solar/` is here for the same reason, and this package's own
 * `CLAUDE.md` names both as where that line falls.
 *
 * **Straight lines, deliberately.** A road-network estimate needs a routing
 * service and a network call, and nothing built on this package makes either.
 * Every caller says so in the text it renders.
 */
const RAD = Math.PI / 180;

/** Mean Earth radius. Good to a few parts per thousand at these distances, which is far below the precision of a coordinate pasted off a map. */
const EARTH_RADIUS_KM = 6371.0088;

export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * A stored [latitude, longitude] pair as numbers, or null when it is not
 * usable. A coordinate in a note is stored as strings, because that is what
 * pasting from a map view produces, so this is where they become arithmetic.
 *
 * Out-of-range values are rejected rather than clamped: a latitude of 91
 * means the pair was pasted wrong or the two halves were swapped, and
 * silently treating it as the north pole would put a place
 * somewhere nobody has ever stood.
 */
export function parseGeoPoint(pair: [string, string] | null): GeoPoint | null {
  if (!pair) return null;
  // Number('') is 0, which is both finite and in range, so a half-filled
  // geoLocation would otherwise resolve to Null Island off the coast of
  // Ghana rather than to "no coordinates". Checked before the conversion
  // rather than after, since 0 is a perfectly good latitude.
  if (pair[0].trim() === '' || pair[1].trim() === '') return null;
  const lat = Number(pair[0]);
  const lon = Number(pair[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = (to.lat - from.lat) * RAD;
  const dLon = (to.lon - from.lon) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * RAD) * Math.cos(to.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Initial bearing from one point to another, in degrees clockwise from
 * north, normalized to [0, 360).
 *
 * "Initial" matters over long distances, where a great circle's bearing
 * changes along the way. Over the few kilometres between two places in one
 * town the difference is invisible, and naming it here is cheaper than having
 * someone wonder later why a transatlantic bearing looks off.
 */
export function bearing(from: GeoPoint, to: GeoPoint): number {
  const dLon = (to.lon - from.lon) * RAD;
  const y = Math.sin(dLon) * Math.cos(to.lat * RAD);
  const x =
    Math.cos(from.lat * RAD) * Math.sin(to.lat * RAD) -
    Math.sin(from.lat * RAD) * Math.cos(to.lat * RAD) * Math.cos(dLon);
  const degrees = Math.atan2(y, x) / RAD;
  return (degrees + 360) % 360;
}

const COMPASS_16 = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

export type CompassPoint = (typeof COMPASS_16)[number];

/**
 * The 16-point compass token nearest a bearing, always in the English rose.
 *
 * A token rather than a translated word, because this package has no strings a
 * person reads: a caller translates it one letter at a time, which is four keys
 * rather than sixteen, since only E differs in German.
 */
export function compassPoint(degrees: number): CompassPoint {
  const normalized = ((degrees % 360) + 360) % 360;
  // The modulo puts the index in 0..15 and the table has 16 entries, so the
  // fallback is unreachable. It is written out rather than asserted away
  // because an index the compiler cannot prove is in range should read as a
  // decision rather than as a `!`.
  return COMPASS_16[Math.round(normalized / 22.5) % 16] ?? 'N';
}

/**
 * A distance as someone would say it out loud: metres below one kilometre,
 * one decimal below ten, whole kilometres above.
 *
 * Two decimals on a coordinate pasted off a map view would be false
 * precision, and "8.9 km" is the answer to the question actually being
 * asked, which is whether the other place is a walk or a drive.
 *
 * **The rounding is the point and the punctuation is not.** This writes a
 * decimal point and the SI symbols, which is what the date stamps here do too;
 * a locale that wants a comma should format `distanceKm` itself rather than
 * ask this to learn about locales. Said out loud because this is the one
 * function in the module that produces something a person reads.
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
