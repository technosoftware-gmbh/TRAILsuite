/**
 * Where photo spots meet the itinerary: which point a day's light is
 * computed at, the golden-hour time a new stop should start from, what the
 * trip still owes you photographically, and which pairs of stops cannot
 * both happen. The band those first two are drawn against is not a trip
 * concept and lives in shared/sun-band.ts.
 *
 * Pure, no 'obsidian' import, so all three are unit-testable -- the
 * rendering that consumes them lives in trips/ui/itinerary-block.ts.
 *
 * See docs/design/photo-spots.md §6.
 */
import { distanceKm, GeoPoint, parseGeoPoint } from 'trail-core';
import { lightWindowRange } from '../places/solar';
import {
  ParsedPhotoSpot,
  ParsedPhotoSpotMotif,
  PhotoSpotLightWindow,
  primaryMotif,
} from '../places/photo-spot-note';
import { TravelPlace, TravelTrip, TravelTripStop } from '../vault/types';

/**
 * The location a day's light should be computed at: the first stop of the
 * day that has coordinates.
 *
 * First rather than, say, the longest stay or an average, because the band
 * is a backdrop and a day's stops are almost always within a few kilometres
 * of each other. When they are not -- a travel day across a country -- no
 * single answer is right, and the first one is at least the one you woke up
 * near.
 *
 * A day with no located stop returns null, and the caller draws no band
 * rather than a wrong one.
 */
export function dayAnchor(stops: TravelTripStop[]): GeoPoint | null {
  for (const stop of stops) {
    const target = stop.target;
    if (!target) continue;
    const point = parseGeoPoint(target.geoLocation);
    if (point) return point;
  }
  return null;
}

export interface StopTimeSuggestion {
  from: Date;
  to: Date | null;
  /** The window the times came from, so the editor can say where they came from rather than presenting them as fact. */
  light: PhotoSpotLightWindow;
}

/**
 * The motif a stop is for.
 *
 * The one the stop names, matched the way samples are matched to motifs
 * (trimmed, case-insensitive), and the spot's primary motif otherwise. A
 * name the spot does not have falls back rather than refusing: the stop is
 * still at that spot, and the design's rule for an unmatched name is to
 * keep it visible rather than to treat the row as broken.
 */
export function stopMotif(
  spot: ParsedPhotoSpot,
  motifName: string | null
): ParsedPhotoSpotMotif | null {
  const key = (value: string | null): string => (value ?? '').trim().toLowerCase();
  if (key(motifName) !== '') {
    const named = spot.motifs.find((motif) => key(motif.name) === key(motifName));
    if (named) return named;
  }
  return primaryMotif(spot);
}

/**
 * When a stop points at a photo spot, the time it probably wants: the first
 * light window of the motif the stop is for, on that date.
 *
 * A suggestion, never a correction. The caller only applies it when the
 * stop has no clock time of its own yet, so picking a spot for a stop you
 * already timed does not move it. Picking the Pavillon des Bains for
 * 14 June should prefill 04:56 to 05:12, not midnight.
 *
 * `motifName` is what makes that the RIGHT window rather than merely a
 * plausible one. The two motifs at Neuchâtel want opposite ends of the day,
 * so a stop that goes for the secondary one and gets the main one's golden
 * hour is wrong by twelve hours and says nothing about why.
 *
 * Returns null for a place that is not a photo spot, one with no motifs,
 * one whose motif names no light, or a date on which that light does not
 * happen -- all of which are ordinary, and none of which is worth guessing
 * around.
 */
export function goldenHourPrefill(
  place: TravelPlace,
  date: Date,
  motifName: string | null = null
): StopTimeSuggestion | null {
  if (place.kind !== 'photospot' || !place.photoSpot) return null;
  const motif = stopMotif(place.photoSpot, motifName);
  if (!motif || motif.light.length === 0) return null;

  const point = parseGeoPoint(motif.geoLocation) ?? parseGeoPoint(place.geoLocation);
  if (!point) return null;

  const range = lightWindowRange(motif.light[0], date, point.lat, point.lon);
  if (!range) return null;
  // An instant (sunrise, sunset) prefills only a start: a stop that begins
  // and ends at the same minute reads as a mistake.
  const to = range.end && range.end.valueOf() !== range.start.valueOf() ? range.end : null;
  return { from: range.start, to, light: motif.light[0] };
}

export interface ShotListEntry {
  spotTitle: string;
  spotPath: string;
  motifName: string;
  captured: boolean;
  capturedOn: string | null;
  /**
   * The day the trip stops at this spot, "YYYY-MM-DD", or null when the
   * stop carries no date.
   *
   * Carried so that ticking a motif off from a trip that has already
   * happened stamps the day you were there rather than the day you got
   * round to recording it.
   */
  stopDay: string | null;
}

/**
 * Every motif at every photo spot this trip stops at, in stop order.
 *
 * A read over data that already exists rather than a new property on the
 * trip: what you owe yourself at a spot belongs to the spot, and copying it
 * onto the trip would be two places to keep in step.
 *
 * A spot the trip stops at twice contributes its motifs once. The itinerary
 * above already shows both visits; a shot list that repeated them would be
 * answering a different question than the one it asks.
 */
export function tripShotList(trip: TravelTrip): ShotListEntry[] {
  const seen = new Set<string>();
  const entries: ShotListEntry[] = [];

  for (const stop of trip.stops) {
    if (stop.targetKind !== 'photospot') continue;
    const place = stop.target as TravelPlace | null;
    if (!place?.photoSpot || seen.has(place.file.path)) continue;
    seen.add(place.file.path);

    for (const motif of place.photoSpot.motifs) {
      if (!motif.name) continue;
      entries.push({
        spotTitle: place.title,
        spotPath: place.file.path,
        motifName: motif.name,
        captured: motif.captured,
        capturedOn: motif.capturedOn,
        stopDay: stop.from?.slice(0, 10) ?? null,
      });
    }
  }

  return entries;
}

/**
 * Walking speed, in kilometres per hour, for the conflict check below.
 *
 * Deliberately walking rather than driving. It is the one assumption that
 * holds everywhere: a rule tuned to a car is wrong on an island with no
 * rental, wrong in a city centre, and wrong on a ridge with no road at all,
 * and being wrong there means staying silent about a plan that cannot
 * happen. Walking over-warns instead, which is the survivable direction for
 * a chip you can ignore. See docs/design/photo-spots.md §6.3.
 */
export const WALKING_SPEED_KMH = 4;

export interface ScheduleConflict {
  /** Index into the trip's own stop list, so the renderer can put the warning on the right row. */
  index: number;
  /** The stop this one cannot be reached from in time. */
  fromIndex: number;
  km: number;
  walkMinutes: number;
  gapMinutes: number;
}

/**
 * Stops on the same day that cannot both happen: the ones you could not
 * walk between in the time the itinerary leaves.
 *
 * The design frames this as a LIGHT conflict, because the case that
 * motivates it is two photo spots both wanting the same golden hour. The
 * check implemented here is the more general one -- scheduled time against
 * travel time -- for two reasons. It catches the same case, since two stops
 * in the same light window are by definition close together in time. And it
 * catches the ordinary version too: a restaurant across the valley from a
 * castle, booked half an hour apart, is the same mistake without a camera
 * in it.
 *
 * Consecutive in the NOTE's order, not in time order. The itinerary
 * deliberately renders stops as written rather than re-sorting them, and a
 * warning that compared a different pair than the one on screen would be
 * unexplainable.
 *
 * Silent unless both stops are dated, timed and located: without all three
 * there is no claim to check, and inventing one would be worse than saying
 * nothing.
 *
 * A negative gap -- the two stops overlapping -- counts. It is the same
 * mistake at its sharpest.
 */
export function scheduleConflicts(stops: TravelTripStop[]): ScheduleConflict[] {
  // Every pair within a day rather than consecutive pairs only. The design
  // frames the rule as two stops wanting the same light, and two stops with
  // a third one listed between them want it just as badly: an evening at a
  // ridge and an evening in town, with dinner in the middle, never used to
  // be compared at all.
  const worst = new Map<number, ScheduleConflict>();

  for (let earlier = 0; earlier < stops.length; earlier++) {
    for (let later = earlier + 1; later < stops.length; later++) {
      const conflict = pairConflict(stops, earlier, later);
      if (!conflict) continue;

      // One row per stop, and the sharpest of that stop's conflicts wins:
      // several warnings on one row would say the same thing three times,
      // and the deepest deficit is the one that makes the day impossible.
      const standing = worst.get(later);
      if (!standing || deficit(conflict) > deficit(standing)) worst.set(later, conflict);
    }
  }

  return [...worst.values()].sort((a, b) => a.index - b.index);
}

/** How badly a pair fails, in minutes: what the walk needs beyond what the plan leaves. */
function deficit(conflict: ScheduleConflict): number {
  return conflict.walkMinutes - conflict.gapMinutes;
}

function pairConflict(
  stops: TravelTripStop[],
  earlier: number,
  later: number
): ScheduleConflict | null {
  const previous = stops[earlier];
  const current = stops[later];

  const leave = previous.to ?? previous.from;
  const arrive = current.from;
  if (!leave || !arrive) return null;
  if (!leave.includes('T') || !arrive.includes('T')) return null;
  if (leave.slice(0, 10) !== arrive.slice(0, 10)) return null;

  const from = previous.target ? parseGeoPoint(previous.target.geoLocation) : null;
  const to = current.target ? parseGeoPoint(current.target.geoLocation) : null;
  if (!from || !to) return null;

  // Deliberately allowed to be negative. Two stops at different places
  // whose times OVERLAP is the sharpest version of this mistake, not an
  // out-of-scope one: you cannot be in two places at once, whatever the
  // distance. An earlier draft skipped negative gaps and silently missed
  // exactly the case the design was written around, two spots booked into
  // the same golden hour.
  const gapMinutes = (Date.parse(arrive) - Date.parse(leave)) / 60000;
  if (!Number.isFinite(gapMinutes)) return null;

  const km = distanceKm(from, to);
  const walkMinutes = (km / WALKING_SPEED_KMH) * 60;
  if (walkMinutes <= gapMinutes) return null;

  return { index: later, fromIndex: earlier, km, walkMinutes, gapMinutes };
}
