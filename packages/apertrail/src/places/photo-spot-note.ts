/**
 * Pure build/parse logic for a Photo Spot note's photography frontmatter --
 * kept free of any 'obsidian' import so it's unit-testable without an App,
 * the same way trip-note.ts is. write-photo-spot.ts wraps this with the
 * vault-write side, and read-entities.ts calls parsePhotoSpotRecord() once
 * per photo spot note.
 *
 * See docs/design/photo-spots.md for the full design. The short version of
 * what lives here and what does not: a photo spot is a place note (§1), so
 * country, city, geoLocation, rating, visited and lastVisit are read by the
 * shared place reader and are none of this file's business. This file owns
 * only what a photo spot has and the other four place types do not: the
 * motifs you came for, the sample frames, and the access details a printed
 * location guide prints in its grey box.
 *
 * Three conventions carried over from trip-note.ts, for the same reasons:
 *
 * 1. Optional fields are OMITTED, never written empty. A spot with one
 *    motif and no samples carries no `samples:` key at all.
 * 2. Anything with a clock time in it is written as a quoted string.
 *    Nothing here currently carries one (`capturedOn` is date-only), but
 *    the rule stands for whatever gets added later.
 * 3. On read, a malformed entry is KEPT rather than dropped. A motif whose
 *    name never parsed is a note that needs fixing and should stay visible
 *    as an unresolved row; silently dropping it would make a typo look
 *    like a deletion.
 */

import { readString } from '@technosoftware/trail-core';
import { APERtrailSettings } from '../settings/types';

/**
 * The light a motif wants, in day order. Property NAMES are settings
 * throughout this plugin; these are property VALUES, and they are
 * deliberately not configurable and never localized in the note itself:
 * the sun calculation and the itinerary's warnings key off these exact
 * strings, and a German vault that wrote `goldene-stunde-abends` into its
 * notes would be unreadable by the same vault switched to English. Only
 * the labels are translated. Same reasoning as TRAVEL_STATUS_VALUES.
 *
 * `overcast` is a member with no clock window attached. It is a real
 * answer for waterfalls and forests, and "any time, as long as the sky is
 * flat" is information worth keeping rather than rounding to `day`.
 */
export const PHOTO_SPOT_LIGHT_WINDOWS = [
  'blue-hour-morning',
  'sunrise',
  'golden-hour-morning',
  'day',
  'overcast',
  'golden-hour-evening',
  'sunset',
  'blue-hour-evening',
  'night',
] as const;

export type PhotoSpotLightWindow = (typeof PHOTO_SPOT_LIGHT_WINDOWS)[number];

export function isPhotoSpotLightWindow(value: unknown): value is PhotoSpotLightWindow {
  return (
    typeof value === 'string' &&
    (PHOTO_SPOT_LIGHT_WINDOWS as readonly string[]).includes(value.trim())
  );
}

/** Zero or one `main` per note. A second one is a health-check warning, not a parse error -- see docs/design/photo-spots.md §8. */
export const PHOTO_SPOT_MOTIF_ROLES = ['main', 'secondary'] as const;
export type PhotoSpotMotifRole = (typeof PHOTO_SPOT_MOTIF_ROLES)[number];

export const PHOTO_SPOT_ACCESSIBILITY_VALUES = ['full', 'partial', 'none', 'unknown'] as const;
export type PhotoSpotAccessibility = (typeof PHOTO_SPOT_ACCESSIBILITY_VALUES)[number];

/**
 * Transit modes the editor offers, each mapping to one icon. Free text on
 * read, exactly like TRIP_LEG_MODES: a hand-written note may say `ferry`,
 * and rendering that with a neutral icon beats discarding the row.
 */
export const PHOTO_SPOT_TRANSIT_MODES = [
  'rail',
  'bus',
  'tram',
  'boat',
  'cablecar',
  'foot',
  'car',
] as const;

/**
 * Compass points accepted on read, English and German. `direction` is
 * WRITTEN as degrees (docs/design/photo-spots.md §11, resolved), because a
 * bearing is what the sun-position comparison needs and rounding a compass
 * point to 22.5 degrees twice is a lossy round trip. Accepting the words is
 * about not punishing a note somebody typed by hand.
 *
 * The German half is not decoration: `O` for Ost is the one letter that
 * differs, it cannot collide with an English point (there is no `O` in the
 * English rose), and a vault written in German would otherwise silently
 * lose every bearing it has.
 */
const COMPASS_POINTS: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

/**
 * A shooting bearing in degrees, normalized to [0, 360).
 *
 * Accepts a number, a numeric string, or a compass point in either
 * language. Returns null for anything else rather than guessing: a motif
 * with no usable bearing simply gets no front/side/back light badge, which
 * is honest, whereas defaulting to north would be a confident lie about
 * where the camera points.
 */
export function parsePhotoSpotDirection(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? normalizeBearing(raw) : null;
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) return normalizeBearing(asNumber);

  // German `O` (Ost) maps onto English `E` before lookup. Done on the
  // whole token rather than per character so `ONO` becomes `ENE` in one
  // step, and safe because no English compass point contains an O.
  const point = trimmed.toUpperCase().replace(/\s+/g, '').replace(/O/g, 'E');
  return point in COMPASS_POINTS ? COMPASS_POINTS[point] : null;
}

function normalizeBearing(value: number): number {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export interface PhotoSpotMotifInput {
  name: string;
  role: PhotoSpotMotifRole;
  /** Optional override. Absent means "the note's own coordinates" -- a motif can sit 16 km from the spot's anchor, which is exactly what the source guide's secondary motifs do. */
  geoLocation: [string, string] | null;
  /** Degrees, the bearing you shoot TOWARD. */
  direction: number | null;
  /** Ordered best-first. */
  light: PhotoSpotLightWindow[];
  /** Months, 1-12. Unambiguous across hemispheres, unlike named seasons. */
  season: number[];
  lens: string | null;
  gear: string[];
  technique: string | null;
  note: string | null;
  /** You were there AND you got the shot. Not the same claim as the note's `visited`, and nothing but a human ever sets it. */
  captured: boolean;
  capturedOn: string | null;
}

export interface PhotoSpotSampleInput {
  image: string;
  /** Matches a motif's `name`. An unmatched value is kept, not dropped. */
  motifName: string | null;
  light: PhotoSpotLightWindow | null;
  /** Printed verbatim ("30s, f/11, ISO 100, ND1000"). Never parsed. */
  exposure: string | null;
  credit: string | null;
}

export interface PhotoSpotTransitInput {
  mode: string | null;
  detail: string | null;
}

/**
 * Every property name the photo spot schema touches, resolved from
 * settings by the caller. One interface rather than ~25 loose parameters,
 * because the builder and the parser need the identical set and a mismatch
 * between them is exactly the bug a round-trip test is meant to catch.
 */
export interface PhotoSpotPropertyNames {
  timezoneProperty: string;
  openingHoursProperty: string;
  entryFeeProperty: string;
  accessibilityProperty: string;
  parkingProperty: string;
  modifiedProperty: string;

  transitProperty: string;
  transitModeField: string;
  transitDetailField: string;

  motifsProperty: string;
  motifNameField: string;
  motifRoleField: string;
  motifGeoField: string;
  motifDirectionField: string;
  motifLightField: string;
  motifSeasonField: string;
  motifLensField: string;
  motifGearField: string;
  motifTechniqueField: string;
  motifNoteField: string;
  motifCapturedField: string;
  motifCapturedOnField: string;

  samplesProperty: string;
  sampleImageField: string;
  sampleMotifField: string;
  sampleLightField: string;
  sampleExposureField: string;
  sampleCreditField: string;
}

/**
 * Maps the flat APERtrailSettings fields onto the property-name bundle
 * the builder and the parser both take -- one place that knows the
 * mapping, so the two halves can never be handed different names.
 *
 * Lives here rather than in read-entities.ts (where tripPropertyNames()
 * sits) because it needs only the settings interface, which imports
 * nothing. Keeping it beside the schema it fills is what lets this whole
 * file be tested without mocking 'obsidian'.
 */
export function photoSpotPropertyNames(settings: APERtrailSettings): PhotoSpotPropertyNames {
  return {
    timezoneProperty: settings.timezoneProperty,
    openingHoursProperty: settings.openingHoursProperty,
    entryFeeProperty: settings.entryFeeProperty,
    accessibilityProperty: settings.accessibilityProperty,
    parkingProperty: settings.parkingProperty,
    modifiedProperty: settings.modifiedProperty,

    transitProperty: settings.transitProperty,
    transitModeField: settings.transitModeField,
    transitDetailField: settings.transitDetailField,

    motifsProperty: settings.motifsProperty,
    motifNameField: settings.motifNameField,
    motifRoleField: settings.motifRoleField,
    motifGeoField: settings.motifGeoField,
    motifDirectionField: settings.motifDirectionField,
    motifLightField: settings.motifLightField,
    motifSeasonField: settings.motifSeasonField,
    motifLensField: settings.motifLensField,
    motifGearField: settings.motifGearField,
    motifTechniqueField: settings.motifTechniqueField,
    motifNoteField: settings.motifNoteField,
    motifCapturedField: settings.motifCapturedField,
    motifCapturedOnField: settings.motifCapturedOnField,

    samplesProperty: settings.samplesProperty,
    sampleImageField: settings.sampleImageField,
    sampleMotifField: settings.sampleMotifField,
    sampleLightField: settings.sampleLightField,
    sampleExposureField: settings.sampleExposureField,
    sampleCreditField: settings.sampleCreditField,
  };
}

export interface PhotoSpotFrontmatterInput {
  properties: PhotoSpotPropertyNames;
  timezone: string | null;
  openingHours: string | null;
  entryFee: string | null;
  /** `unknown` is written as nothing at all: it is the absence of an answer, not an answer. */
  accessibility: PhotoSpotAccessibility;
  parking: string | null;
  transit: PhotoSpotTransitInput[];
  motifs: PhotoSpotMotifInput[];
  samples: PhotoSpotSampleInput[];
  /** Stamped on every write when provided. */
  modified: string | null;
}

function cleanString(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function cleanList(values: string[]): string[] {
  return values.map((v) => v.trim()).filter((v) => v !== '');
}

/**
 * Builds the plain frontmatter object for a photo spot's photography keys
 * -- not a YAML string, so callers and tests can inspect it directly.
 *
 * Note what is NOT here: type, country, city, geoLocation, address,
 * website, rating, visited, lastVisit. Those belong to the shared place
 * shape, they are all scalars Obsidian's own property editor renders
 * perfectly well, and two writers owning the same key is how a note ends
 * up with a value neither of them meant to put there. See
 * photoSpotManagedKeys() for the boundary this draws.
 */
export function buildPhotoSpotFrontmatter(
  input: PhotoSpotFrontmatterInput
): Record<string, unknown> {
  const p = input.properties;
  const yaml: Record<string, unknown> = {};

  const timezone = cleanString(input.timezone);
  const openingHours = cleanString(input.openingHours);
  const entryFee = cleanString(input.entryFee);
  const parking = cleanString(input.parking);
  if (timezone) yaml[p.timezoneProperty] = timezone;
  if (openingHours) yaml[p.openingHoursProperty] = openingHours;
  if (entryFee) yaml[p.entryFeeProperty] = entryFee;
  if (input.accessibility !== 'unknown') yaml[p.accessibilityProperty] = input.accessibility;
  if (parking) yaml[p.parkingProperty] = parking;

  // A transit row with neither a mode nor a detail says nothing. One with
  // only a detail is kept: "no direct rail connection" is a useful thing
  // to have written down even before anyone picks an icon for it.
  const transit = input.transit
    .filter((row) => cleanString(row.mode) !== null || cleanString(row.detail) !== null)
    .map((row) => {
      const entry: Record<string, unknown> = {};
      const mode = cleanString(row.mode);
      const detail = cleanString(row.detail);
      if (mode) entry[p.transitModeField] = mode;
      if (detail) entry[p.transitDetailField] = detail;
      return entry;
    });
  if (transit.length > 0) yaml[p.transitProperty] = transit;

  // The name IS the motif: it is what a sample's `motif` points back at
  // and what the shot list lists, so a nameless entry is dropped on write
  // the way a placeless stop is. Every other sub-key is omitted
  // individually, so a motif that is just a name and a light window
  // serializes as two keys rather than twelve nulls.
  const motifs = input.motifs
    .filter((motif) => cleanString(motif.name) !== null)
    .map((motif) => {
      const entry: Record<string, unknown> = {
        [p.motifNameField]: motif.name.trim(),
        [p.motifRoleField]: motif.role,
      };
      if (motif.geoLocation) entry[p.motifGeoField] = [...motif.geoLocation];
      if (motif.direction !== null) entry[p.motifDirectionField] = motif.direction;
      if (motif.light.length > 0) entry[p.motifLightField] = [...motif.light];
      if (motif.season.length > 0) entry[p.motifSeasonField] = [...motif.season];

      const lens = cleanString(motif.lens);
      const gear = cleanList(motif.gear);
      const technique = cleanString(motif.technique);
      const note = cleanString(motif.note);
      const capturedOn = cleanString(motif.capturedOn);
      if (lens) entry[p.motifLensField] = lens;
      if (gear.length > 0) entry[p.motifGearField] = gear;
      if (technique) entry[p.motifTechniqueField] = technique;
      if (note) entry[p.motifNoteField] = note;
      // Written only when true. `captured: false` is the default state of
      // every motif ever created, and writing it out would put a key in
      // every note to say nothing has happened yet.
      if (motif.captured) {
        entry[p.motifCapturedField] = true;
        if (capturedOn) entry[p.motifCapturedOnField] = capturedOn;
      }
      return entry;
    });
  if (motifs.length > 0) yaml[p.motifsProperty] = motifs;

  const samples = input.samples
    .filter((sample) => cleanString(sample.image) !== null)
    .map((sample) => {
      const entry: Record<string, unknown> = { [p.sampleImageField]: sample.image.trim() };
      const motifName = cleanString(sample.motifName);
      const exposure = cleanString(sample.exposure);
      const credit = cleanString(sample.credit);
      if (motifName) entry[p.sampleMotifField] = motifName;
      if (sample.light) entry[p.sampleLightField] = sample.light;
      if (exposure) entry[p.sampleExposureField] = exposure;
      if (credit) entry[p.sampleCreditField] = credit;
      return entry;
    });
  if (samples.length > 0) yaml[p.samplesProperty] = samples;

  // A blank property name means the vault asked for no stamp at all, so
  // nothing is written rather than a key with an empty name.
  const modified = cleanString(input.modified);
  if (modified && p.modifiedProperty) yaml[p.modifiedProperty] = modified;

  return yaml;
}

/**
 * Every frontmatter key the photo spot schema owns, and nothing more.
 *
 * updatePhotoSpotNote() clears these before applying new values, so a
 * motif list emptied during an edit does not linger from before it. The
 * list deliberately stops short of the place-shape keys: `visited` and
 * `lastVisit` can be DERIVED from the trips that stopped here rather than
 * written in the note (vault/visit-derivation.ts), and a writer that
 * cleared and rewrote them would turn a derived value into a written one
 * as a side effect of editing a motif. That is exactly the "some fields
 * are derived, never written back" rule, and the cheapest way to honor it
 * is to never hold the pen.
 */
export function photoSpotManagedKeys(p: PhotoSpotPropertyNames): string[] {
  return [
    p.timezoneProperty,
    p.openingHoursProperty,
    p.entryFeeProperty,
    p.accessibilityProperty,
    p.parkingProperty,
    p.transitProperty,
    p.motifsProperty,
    p.samplesProperty,
    p.modifiedProperty,
  ];
}

function readBool(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') return raw.trim().toLowerCase() === 'true';
  return false;
}

/**
 * A two-element [latitude, longitude] pair, as pasted from a map view.
 * Deliberately a local copy of read-entities.ts's own reader rather than
 * an import: that module is App-bound, and the whole point of this file is
 * that it parses without one. readString() next to it is no longer a local
 * copy, because trail-core is App-free too; readBool() still is, because
 * the core's readBooleanLike() returns null for a value it cannot read and
 * every caller here wants a plain false.
 */
function readGeoPair(raw: unknown): [string, string] | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const [lat, lng] = raw as unknown[];
  if (
    (typeof lat !== 'string' && typeof lat !== 'number') ||
    (typeof lng !== 'string' && typeof lng !== 'number')
  )
    return null;
  return [String(lat), String(lng)];
}

/** A list-valued property, tolerating the single scalar a user typing one value into Obsidian's property editor ends up with. */
function readStringList(raw: unknown): string[] {
  const values = Array.isArray(raw) ? (raw as unknown[]) : [raw];
  return values.map(readString).filter((v): v is string => v !== null);
}

/** Months as numbers, 1-12. Anything outside that range is dropped rather than clamped: month 13 is a typo, not December. */
function readMonthList(raw: unknown): number[] {
  const values = Array.isArray(raw) ? (raw as unknown[]) : [raw];
  return values
    .map((v) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && v.trim() !== '') return Number(v.trim());
      return NaN;
    })
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
}

function readLightList(raw: unknown): PhotoSpotLightWindow[] {
  return readStringList(raw).filter(isPhotoSpotLightWindow);
}

/** Frontmatter list entries, as plain records -- anything that isn't an object is skipped rather than coerced. */
function objectEntries(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null
  );
}

export interface ParsedPhotoSpotMotif {
  /** Null when the entry carried no usable name -- kept rather than dropped, so a typo stays visible instead of looking like a deletion. */
  name: string | null;
  role: PhotoSpotMotifRole;
  geoLocation: [string, string] | null;
  direction: number | null;
  light: PhotoSpotLightWindow[];
  season: number[];
  lens: string | null;
  gear: string[];
  technique: string | null;
  note: string | null;
  captured: boolean;
  capturedOn: string | null;
}

export interface ParsedPhotoSpotSample {
  image: string | null;
  motifName: string | null;
  light: PhotoSpotLightWindow | null;
  exposure: string | null;
  credit: string | null;
}

export interface ParsedPhotoSpotTransit {
  mode: string | null;
  detail: string | null;
}

export interface ParsedPhotoSpot {
  timezone: string | null;
  openingHours: string | null;
  entryFee: string | null;
  accessibility: PhotoSpotAccessibility;
  parking: string | null;
  transit: ParsedPhotoSpotTransit[];
  motifs: ParsedPhotoSpotMotif[];
  samples: ParsedPhotoSpotSample[];
}

export interface ParsePhotoSpotRecordInput {
  properties: PhotoSpotPropertyNames;
  frontmatter: Record<string, unknown>;
}

/**
 * The mirror image of buildPhotoSpotFrontmatter(). Pure, so it can be
 * unit-tested by round-tripping the builder's own output rather than
 * against a hand-written fixture that could drift from what is really
 * written.
 */
export function parsePhotoSpotRecord(input: ParsePhotoSpotRecordInput): ParsedPhotoSpot {
  const p = input.properties;
  const fm = input.frontmatter;

  const rawAccessibility = readString(fm[p.accessibilityProperty]);
  const accessibility = (PHOTO_SPOT_ACCESSIBILITY_VALUES as readonly string[]).includes(
    rawAccessibility ?? ''
  )
    ? (rawAccessibility as PhotoSpotAccessibility)
    : 'unknown';

  return {
    timezone: readString(fm[p.timezoneProperty]),
    openingHours: readString(fm[p.openingHoursProperty]),
    entryFee: readString(fm[p.entryFeeProperty]),
    // An absent or unrecognized value reads as `unknown`, never as `none`.
    // "Nobody has said" and "there is no step-free access" are different
    // claims, and only one of them is safe to make on a user's behalf.
    accessibility,
    parking: readString(fm[p.parkingProperty]),
    transit: objectEntries(fm[p.transitProperty]).map((entry) => ({
      mode: readString(entry[p.transitModeField]),
      detail: readString(entry[p.transitDetailField]),
    })),
    motifs: objectEntries(fm[p.motifsProperty]).map((entry) => ({
      name: readString(entry[p.motifNameField]),
      // Anything that isn't explicitly "main" is secondary. A motif has to
      // render under some role, and a note that names one motif without
      // marking it is far more likely to have meant a plain entry than a
      // second headline act.
      role: readString(entry[p.motifRoleField]) === 'main' ? 'main' : 'secondary',
      geoLocation: readGeoPair(entry[p.motifGeoField]),
      direction: parsePhotoSpotDirection(entry[p.motifDirectionField]),
      light: readLightList(entry[p.motifLightField]),
      season: readMonthList(entry[p.motifSeasonField]),
      lens: readString(entry[p.motifLensField]),
      gear: readStringList(entry[p.motifGearField]),
      technique: readString(entry[p.motifTechniqueField]),
      note: readString(entry[p.motifNoteField]),
      captured: readBool(entry[p.motifCapturedField]),
      capturedOn: readString(entry[p.motifCapturedOnField]),
    })),
    samples: objectEntries(fm[p.samplesProperty]).map((entry) => {
      const light = readString(entry[p.sampleLightField]);
      return {
        image: readString(entry[p.sampleImageField]),
        motifName: readString(entry[p.sampleMotifField]),
        light: isPhotoSpotLightWindow(light) ? light : null,
        exposure: readString(entry[p.sampleExposureField]),
        credit: readString(entry[p.sampleCreditField]),
      };
    }),
  };
}

/**
 * The motif a spot is named for, or null when nothing claims the role.
 * Used by the gallery card, the dashboard's capture count and the
 * itinerary's golden-hour prefill, all of which need "the one motif" and
 * should agree on which it is.
 *
 * First `main` wins rather than last, and a note with no `main` at all
 * falls back to its first motif rather than to nothing: a spot with one
 * unmarked motif is still a spot with a motif.
 */
export function primaryMotif(spot: ParsedPhotoSpot): ParsedPhotoSpotMotif | null {
  return spot.motifs.find((motif) => motif.role === 'main') ?? spot.motifs[0] ?? null;
}

/** How many of a spot's motifs you have actually shot -- the numerator behind "1 of 2 captured". */
export function capturedMotifCount(spot: ParsedPhotoSpot): number {
  return spot.motifs.filter((motif) => motif.captured).length;
}

/**
 * How far through a spot you are, as one word.
 *
 * `empty` is its own answer rather than folded into `none`: a spot whose
 * motifs nobody has written down yet is not a spot you owe pictures at, and
 * a "nothing captured" filter that surfaced every unfilled note would be
 * answering the wrong question.
 */
export type PhotoSpotCaptureState = 'empty' | 'none' | 'partial' | 'full';

export function captureState(spot: ParsedPhotoSpot): PhotoSpotCaptureState {
  const total = spot.motifs.length;
  if (total === 0) return 'empty';
  const captured = capturedMotifCount(spot);
  if (captured === 0) return 'none';
  return captured === total ? 'full' : 'partial';
}
