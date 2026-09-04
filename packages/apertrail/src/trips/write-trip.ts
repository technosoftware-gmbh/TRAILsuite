/**
 * Vault-write side of Trip notes -- see trips/trip-note.ts for the pure
 * frontmatter build/parse logic this wraps.
 *
 * Kept out of create-entities.ts (which holds the seven other Travel
 * entity types) because Trips are the only Travel entity with an edit
 * path: every other type is create-then-hand-edit, whereas a trip is
 * built up over time as it's planned and then reviewed. That edit path is
 * what makes updateTripNote() below necessary, and it brings its own
 * requirement -- never clobber the note body -- that the other seven
 * don't have.
 */
import { App, normalizePath, TFile } from 'obsidian';
import { APERtrailSettings } from '../settings/types';
import { APT_TRIP_COSTS_BLOCK_LANG } from './costs/trip-costs-block-lang';
import { renderFrontmatterBlock } from 'trail-core/obsidian';
import { createNote } from '../shared/note-creation';
import { formatDateTimeStamp } from 'trail-core';
import { tripPropertyNames } from '../vault/read-entities';
import { newTripFolder } from './trip-folder';
import type { TripGalleryInput } from './trip-note';
import { touchModified } from '../vault/note-stamps';
import { TravelTrip } from '../vault/types';
import {
  TravelStatusValue,
  TripBudgetInput,
  TripDayInput,
  TripFrontmatterInput,
  TripLegInput,
  TripNightInput,
  TripRateInput,
  TripStopInput,
  buildTripFrontmatter,
  tripManagedKeys,
} from './trip-note';

/**
 * The itinerary code block a newly-created Trip note gets in its body --
 * see trips/ui/itinerary-block.ts for the renderer registered under it.
 *
 * The `travel-` prefix stays even though the plugin is no longer named
 * that: this string is written into users' own trip notes, so renaming it
 * would silently stop every existing note's itinerary from rendering.
 */
export const TRAVEL_ITINERARY_BLOCK_LANG = 'travel-itinerary';

export interface TripInput {
  /** What the trip is, under what it is called. */
  subtitle: string | null;
  /** The one picture that stands for it. A vault path, a wikilink or a URL. */
  image: string | null;
  highlights: string[];
  gallery: TripGalleryInput[];
  countryTitle: string | null;
  cityTitles: string[];
  departure: string | null;
  return: string | null;
  travelType: string | null;
  travelStatus: TravelStatusValue | null;
  reviewStatus: string | null;
  rating: number | null;
  personTitles: string[];
  /** What each day of the trip is called, for the days that say. Sparse: a day with only stops on it has no entry. */
  days: TripDayInput[];
  stops: TripStopInput[];
  nights: TripNightInput[];
  transport: TripLegInput[];
  /** The trip's own money. Edited from the costs block, since both lists are lists of maps the property editor will not render. */
  currency: string | null;
  budget: TripBudgetInput[];
  rates: TripRateInput[];
}

/**
 * The two stamps a write can carry. They are mutually exclusive here by
 * design rather than by accident: creation stamps `created` only, an edit
 * stamps `modified` only. See vault/note-stamps.ts for why a brand-new note
 * carries no `modified`, and why an edit never re-emits `created`.
 */
interface TripStamps {
  created: Date | null;
  modified: Date | null;
}

function frontmatterInput(
  settings: APERtrailSettings,
  input: TripInput,
  stamps: TripStamps
): TripFrontmatterInput {
  return {
    properties: tripPropertyNames(settings),
    typeValue: 'trip',
    ...input,
    created: stamps.created ? formatDateTimeStamp(stamps.created) : null,
    modified: stamps.modified ? formatDateTimeStamp(stamps.modified) : null,
  };
}

/**
 * The body a brand-new Trip note starts with: the itinerary block, and
 * nothing else. Deliberately no headings scaffold -- the reference
 * vault's own trips put free prose straight into the body, and imposing
 * an "## Review" skeleton on every trip would be the plugin deciding how
 * someone writes.
 */
function initialBody(): string {
  // The costs block joins it, so a trip answers "what is this going to cost"
  // from the moment it exists rather than once somebody remembers the fence.
  // It renders as a short empty strip until the first booking names the trip.
  return (
    `\n\`\`\`${TRAVEL_ITINERARY_BLOCK_LANG}\n\`\`\`\n` +
    `\n\`\`\`${APT_TRIP_COSTS_BLOCK_LANG}\n\`\`\`\n`
  );
}

/**
 * A trip read back from the vault, as the input shape the writer takes --
 * so a caller that only wants to change one stop can round-trip
 * everything else unchanged rather than rebuilding it field by field.
 * Used by the itinerary block's per-item editing.
 */
export function tripToInput(trip: TravelTrip): TripInput {
  return {
    subtitle: trip.subtitle,
    image: trip.image,
    highlights: [...trip.highlights],
    gallery: trip.gallery.map((picture) => ({ ...picture })),
    countryTitle: trip.countryTitle,
    currency: trip.currency,
    budget: trip.budget.map((line) => ({ category: line.category, amount: line.amount })),
    rates: trip.rates.map((rate) => ({ currency: rate.currency, rate: rate.rate })),
    cityTitles: [...trip.cityTitles],
    departure: trip.departure,
    return: trip.return,
    travelType: trip.travelType,
    travelStatus: trip.travelStatus,
    reviewStatus: trip.reviewStatus,
    rating: trip.rating,
    personTitles: [...trip.personTitles],
    days: trip.days.map((day) => ({ ...day })),
    // placeTitle is non-null on the input side; a stop whose link never
    // resolved keeps its raw text so an edit elsewhere on the trip doesn't
    // silently drop the broken row.
    stops: trip.stops.map((stop) => ({
      placeTitle: stop.placeTitle ?? '',
      day: stop.day,
      from: stop.from,
      to: stop.to,
      note: stop.note,
      rating: stop.rating,
      motifName: stop.motifName,
      cost: stop.cost,
      currency: stop.currency,
      costUnit: stop.costUnit,
      persons: [...stop.persons],
    })),
    nights: trip.nights.map((night) => ({
      accommodationTitle: night.accommodationTitle ?? '',
      checkInDay: night.checkInDay,
      checkOutDay: night.checkOutDay,
      checkIn: night.checkIn,
      checkOut: night.checkOut,
      cost: night.cost,
      currency: night.currency,
      costUnit: night.costUnit,
      persons: [...night.persons],
    })),
    transport: trip.transport.map((leg) => ({ ...leg, persons: [...leg.persons] })),
  };
}

export async function createTripNote(
  app: App,
  settings: APERtrailSettings,
  title: string,
  input: TripInput,
  now: Date = new Date()
): Promise<TFile> {
  const yaml = buildTripFrontmatter(
    frontmatterInput(settings, input, { created: now, modified: null })
  );
  // A folder of its own, named after the trip: see `trip-folder.ts` for why,
  // and for why a trip already flat in `Trips/` goes on working where it is.
  return createNote(
    app,
    newTripFolder(settings, title),
    title,
    renderFrontmatterBlock(yaml) + initialBody()
  );
}

/**
 * Updates an existing Trip note in place through processFrontMatter(), so
 * whatever the vault owner wrote in the body -- which for every real trip
 * in the reference vault is the actual story of the trip -- survives an
 * edit untouched. Same reasoning as updateOrderNote() and
 * archive-note.ts.
 *
 * Stale keys are cleared before the new values are applied, rather than
 * Object.assign-ing over the top: buildTripFrontmatter() only ever emits
 * the keys that SHOULD currently be present, so a stop list emptied
 * during this edit would otherwise linger from before it. Only keys this
 * feature actually owns are cleared (tripManagedKeys), so frontmatter a
 * user hand-added outside the Trip schema -- an `icon:`, an `image:`, the
 * `created:` stamp -- is left exactly as it was.
 */
export async function updateTripNote(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  input: TripInput,
  now: Date = new Date()
): Promise<TFile> {
  const properties = tripPropertyNames(settings);
  const yaml = buildTripFrontmatter(
    frontmatterInput(settings, input, { created: null, modified: now })
  );
  const managed = tripManagedKeys(properties);

  await app.fileManager.processFrontMatter(file, (fm) => {
    const record = fm as Record<string, unknown>;
    for (const key of managed) delete record[key];
    Object.assign(record, yaml);
  });

  return file;
}

/**
 * Appends an itinerary block to a Trip note that has none -- for trips
 * created before this feature existed, or written by hand. Returns false
 * (writing nothing) when the note already has one, so this is safe to
 * call unconditionally after an edit.
 *
 * The append is a real edit of an existing note, so it stamps `modified`.
 * No flag is needed to keep the creation flow out of that: createTripNote()
 * seeds the block into the note's initial content, so a call made straight
 * after creation finds the block already there and returns above without
 * writing anything at all. Only a note that genuinely lacked the block is
 * ever touched, and that is by definition a repair of an older note.
 *
 * The stamp is a second pass over the file rather than part of the append,
 * because an append is a body write and `modified` lives in frontmatter.
 */
export async function ensureItineraryBlock(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  now: Date = new Date()
): Promise<boolean> {
  const existing = await app.vault.read(file);
  if (existing.includes(`\`\`\`${TRAVEL_ITINERARY_BLOCK_LANG}`)) return false;
  await app.vault.append(file, initialBody());
  await touchModified(app, settings, file, now);
  return true;
}

/** Resolves a trip title to its note path under the configured Trips folder, without touching the vault. */
export function tripNotePath(settings: APERtrailSettings, title: string): string {
  return normalizePath(`${settings.tripsFolder}/${title.trim().replace(/\//g, '-')}.md`);
}
