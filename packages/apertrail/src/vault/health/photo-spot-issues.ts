/**
 * The two photo spot checks the design asks the health check to carry
 * (docs/design/photo-spots.md §8), both warnings rather than errors: more
 * than one motif claiming `role: main`, and a sample naming a motif the
 * note does not have.
 *
 * Warnings, because a half-filled spot is a normal state rather than a
 * broken note, and because neither has a fix the plugin may apply on its
 * own: which motif is the main one, and what a sample was meant to point
 * at, are answers only the person who wrote the note has. That is why this
 * file has no `apply` half, unlike entity-type-issues.ts beside it.
 *
 * The rule half is pure and takes a parsed spot, so it is testable without
 * a vault. The scan half goes through the same reader every other surface
 * uses, which keeps "is this a photo spot" answered by folder AND type here
 * as everywhere else.
 */
import { App, TFile } from 'obsidian';
import { GeoPoint, parseGeoPoint } from 'trail-core';
import { APERtrailSettings } from '../../settings/types';
import { ParsedPhotoSpot } from '../../places/photo-spot-note';
import { readTravelBoard } from '../read-entities';

/**
 * A union rather than one shape with optional fields: the three warnings
 * carry genuinely different evidence, and a row that has to render "the
 * motif names" for a warning that has none would be reading a field that
 * means nothing there.
 */
export type PhotoSpotWarning =
  | { kind: 'multipleMain'; names: string[] }
  | { kind: 'orphanSample'; motifName: string; image: string | null }
  | { kind: 'missingTimeZone'; impliedOffset: string };

export type PhotoSpotIssue = PhotoSpotWarning & { file: TFile };

/**
 * What is wrong with one spot, in note order.
 *
 * Deliberately silent about a sample with NO motif name: the block renders
 * those under the spot on purpose, and a note whose motifs nobody has
 * written down yet would otherwise warn once per frame in it.
 */
export function photoSpotWarnings(spot: ParsedPhotoSpot): PhotoSpotWarning[] {
  const warnings: PhotoSpotWarning[] = [];

  const mains = spot.motifs.filter((motif) => motif.role === 'main');
  if (mains.length > 1) {
    warnings.push({ kind: 'multipleMain', names: mains.map((motif) => motif.name ?? '') });
  }

  // The same matching rule photoSpotView() files samples by, down to the
  // trim and the case fold. A stricter copy here would warn about samples
  // the block has already put under their motif, which is the health-check
  // failure mode the codebase works hardest to avoid.
  const key = (name: string | null): string => (name ?? '').trim().toLowerCase();
  const known = new Set(spot.motifs.map((motif) => key(motif.name)).filter((name) => name !== ''));

  for (const sample of spot.samples) {
    const name = key(sample.motifName);
    if (name === '' || known.has(name)) continue;
    warnings.push({
      kind: 'orphanSample',
      motifName: sample.motifName ?? '',
      image: sample.image,
    });
  }

  return warnings;
}

/** The solar offset a longitude implies, in minutes: four minutes of sun per degree. */
export function impliedOffsetMinutes(lon: number): number {
  return lon * 4;
}

/** `UTC+2`, `UTC-1`, `UTC+0`. An offset rather than a zone name, because a longitude cannot know about politics and pretending otherwise would be the worse answer. */
function formatUtcOffset(minutes: number): string {
  const hours = Math.round(minutes / 60);
  return `UTC${hours < 0 ? '-' : '+'}${Math.abs(hours)}`;
}

/**
 * How far a spot's own solar time may sit from the device's standard time
 * before the missing zone is worth mentioning, in minutes.
 *
 * Ninety, and the number is a compromise rather than a fact. Political
 * zones are not solar ones: Spain runs an hour ahead of its longitude and
 * western France more than that, so a tighter threshold would warn on
 * every note in a Spanish vault, which is the same as not warning at all.
 * A looser one would stay quiet about a British spot in a Swiss vault,
 * which is an hour of golden hour. This errs toward silence, which is the
 * survivable direction for a row nobody can act on automatically.
 */
const ZONE_WARNING_THRESHOLD_MINUTES = 90;

/**
 * The spot whose light is being computed in the wrong zone.
 *
 * `timezone:` is optional and falls back to the device's, which is right
 * for a vault used entirely at home and silently wrong for a spot in
 * Iceland: the times look plausible and are hours out. The design named
 * this failure exactly ("the plugin says golden hour is at 03:40 and
 * nothing else"), and this is the cheap half of answering it; the other
 * half is the sun panel saying which zone it is using.
 *
 * The device offset is a parameter rather than read here, so this stays a
 * function of its inputs and a test does not depend on the machine or the
 * month it runs in. It should be STANDARD time: comparing against a summer
 * offset would make every vault in the northern hemisphere an hour more
 * suspicious of itself between March and October.
 */
export function timeZoneWarning(
  spot: ParsedPhotoSpot,
  anchor: GeoPoint | null,
  deviceStandardOffsetMinutes: number
): PhotoSpotWarning | null {
  if (spot.timezone?.trim()) return null;
  if (!anchor) return null;

  const implied = impliedOffsetMinutes(anchor.lon);
  if (Math.abs(implied - deviceStandardOffsetMinutes) < ZONE_WARNING_THRESHOLD_MINUTES) return null;

  return { kind: 'missingTimeZone', impliedOffset: formatUtcOffset(implied) };
}

/**
 * The device's offset with daylight saving taken out of it: the smaller of
 * the two solstice offsets, which is standard time in either hemisphere.
 */
function deviceStandardOffsetMinutes(now: Date): number {
  const year = now.getFullYear();
  const january = -new Date(year, 0, 1).getTimezoneOffset();
  const july = -new Date(year, 6, 1).getTimezoneOffset();
  return Math.min(january, july);
}

/** Every photo spot in the vault, in path order, with the warnings each one earns. */
export function scanPhotoSpotIssues(app: App, settings: APERtrailSettings): PhotoSpotIssue[] {
  const board = readTravelBoard(app, settings);
  const issues: PhotoSpotIssue[] = [];
  const deviceOffset = deviceStandardOffsetMinutes(new Date());

  for (const place of board.places) {
    if (place.kind !== 'photospot' || !place.photoSpot) continue;
    for (const warning of photoSpotWarnings(place.photoSpot)) {
      issues.push({ ...warning, file: place.file });
    }
    const zone = timeZoneWarning(place.photoSpot, parseGeoPoint(place.geoLocation), deviceOffset);
    if (zone) issues.push({ ...zone, file: place.file });
  }

  return issues.sort((a, b) => a.file.path.localeCompare(b.file.path));
}
