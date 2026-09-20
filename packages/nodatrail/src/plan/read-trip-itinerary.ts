/**
 * Reading APERtrail's trip notes, and turning an itinerary into the entries a
 * day note would hold.
 *
 * **NODAtrail reads a trip and never writes one.** A trip says what is meant to
 * happen on a day; whether it happened is the day note's to say. See
 * `docs/design/day-entry-links.md` J.1 and J.2, which is the whole division of
 * labour this file implements one half of.
 *
 * **It reads the note, not the plugin.** There is no import from APERtrail and
 * there cannot be: `package-boundary` forbids it. What the two sides share is
 * `trail-core`'s `TRIP_CONTRACT`, which pins the defaults each ships, and the
 * twelve fixed type values. The failure mode a contract exists to prevent is
 * the quiet one -- a sub-key that does not match yields a stop with no place on
 * it rather than an error.
 *
 * **A trip is a shape before it is a set of dates.** A stop may say `day: 3`
 * with a bare `14:00` instead of a date, and `relative-days.ts` in the core
 * resolves that against the trip's departure. A reader that did not know the
 * convention would skip every relative stop rather than mis-date it, which is
 * why that module moved into the core alongside the contract.
 */
import type { App } from 'obsidian';
import {
  endpointDate,
  clockTime,
  readNotesOfType,
  readString,
  readStringList,
  stripWikilink,
  type NoteKindQuery,
} from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';

/**
 * The `type:` value a trip note carries.
 *
 * A literal rather than a setting, and deliberately not in the contract: it is
 * one of the twelve fixed travel values, which both plugins import rather than
 * configure. Only the folder it lives in is a setting.
 */
const TRIP_TYPE = 'trip';

/** One stop, as far as a day note cares. */
export interface TripStop {
  /** ISO day, or null for a stop nothing can place: no date, and no day number on a dated trip. */
  day: string | null;
  /** `09:00`, or empty. */
  from: string;
  /** `12:00`, or empty. */
  to: string;
  /**
   * What the line says.
   *
   * The excursion where there is one, because that is what the afternoon was;
   * otherwise the place, because that is where it was. A stop that names both
   * says the outing, and the place goes on a child line once the format carries
   * one (section D.5 of the design).
   */
  text: string;
  /** The place note's title, brackets off. Carried for the preview and for the children to come. */
  place: string;
  /** The excursion note's title, brackets off. */
  excursion: string;
  /** Who takes this stop, where the note says it is not everybody. Titles, brackets off. */
  persons: string[];
  /**
   * Offered rather than planned: `optional: true` without `chosen: true`.
   *
   * Carried rather than filtered out here, so the preview can say why a stop
   * produced nothing. An importer that silently dropped them would look like
   * one that had lost them.
   */
  offered: boolean;
}

/** One trip note, as far as a day note cares. */
export interface TripItinerary {
  title: string;
  /** `Planned`, `Booked`, `Over`, `Cancelled`, or empty. */
  status: string;
  departure: string;
  return: string;
  /** Everybody on the trip. A stop's own list narrows this rather than replacing it. */
  persons: string[];
  stops: TripStop[];
}

function tripQuery(settings: NODAtrailSettings): NoteKindQuery {
  return {
    folders: [settings.tripsFolder],
    typePropertyName: settings.typePropertyName,
    typeValue: TRIP_TYPE,
  };
}

/** A frontmatter value as a note title, brackets and any alias off. */
function title(value: unknown): string {
  const raw = readString(value);
  if (!raw) return '';
  const [target = ''] = stripWikilink(raw).split('|');
  return target.trim();
}

/** A list-valued sub-key as note titles. */
function titles(value: unknown): string[] {
  return readStringList(value)
    .map((one) => title(one))
    .filter((one) => one !== '');
}

/** A sub-key whose only interesting value is `true`. */
function flag(value: unknown): boolean {
  return value === true;
}

function stopOf(raw: unknown, settings: NODAtrailSettings, departure: string): TripStop | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;

  const place = title(entry[settings.stopPlaceField]);
  const excursion = title(entry[settings.stopExcursionField]);
  const text = excursion || place;
  // A stop that names neither is a row somebody started and did not finish.
  // There is nothing to write and nothing to say about it.
  if (!text) return null;

  const from = readString(entry[settings.stopFromField]);
  const to = readString(entry[settings.stopToField]);
  const dayNumber = entry[settings.stopDayField];

  return {
    day: endpointDate(
      { day: typeof dayNumber === 'number' ? dayNumber : null, value: from },
      departure || null
    ),
    from: clockTime(from) ?? '',
    to: clockTime(to) ?? '',
    text,
    place,
    excursion,
    persons: titles(entry[settings.stopPersonsField]),
    offered: flag(entry[settings.stopOptionalField]) && !flag(entry[settings.stopChosenField]),
  };
}

/** One trip note's itinerary, in the order the note lists it. */
export function itineraryOf(
  title_: string,
  frontmatter: Record<string, unknown>,
  settings: NODAtrailSettings
): TripItinerary {
  const departure = readString(frontmatter[settings.departureProperty]) ?? '';
  const raw = frontmatter[settings.stopsProperty];
  const rows = Array.isArray(raw) ? (raw as unknown[]) : [];

  return {
    title: title_,
    status: readString(frontmatter[settings.travelStatusProperty]) ?? '',
    departure,
    return: readString(frontmatter[settings.returnProperty]) ?? '',
    persons: titles(frontmatter[settings.personsProperty]),
    stops: rows
      .map((row) => stopOf(row, settings, departure))
      .filter((stop): stop is TripStop => stop !== null),
  };
}

/**
 * Every trip note, title-sorted, with its itinerary read.
 *
 * **A blank trips folder reads nothing**, which is `readNotesOfType`'s own
 * guard and what the settings page offers as the way to switch this off.
 *
 * Nothing is filtered by status here. A cancelled trip is a trip somebody can
 * still choose in the dialog and see has no days worth writing, which is a
 * better answer than a dropdown that quietly does not list it.
 */
export function readTrips(app: App, settings: NODAtrailSettings): TripItinerary[] {
  return readNotesOfType(hostFor(app), tripQuery(settings)).map((note) =>
    itineraryOf(note.title, note.frontmatter, settings)
  );
}
