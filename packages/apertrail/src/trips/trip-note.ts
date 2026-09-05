/**
 * Pure build/parse logic for a Trip note's frontmatter -- kept free of any
 * 'obsidian' import so it's unit-testable without an App.
 * create-entities.ts wraps this with the actual vault-write side, and
 * read-entities.ts calls parseTripRecord() once per Trip note.
 *
 * See docs/design/trip-model-redesign.md for the full design. The short
 * version of why this file exists at all: the original Trip entity
 * modeled a title, a Country and two dates, which cannot represent even a
 * simple day trip ("two people drove to Maienfeld and ate at the Falknis
 * from 12:00 until 13:30"). This schema adds participants, the cities a
 * trip touches, a timed itinerary, accommodation nights and transport
 * legs.
 *
 * Two conventions worth knowing before reading further:
 *
 * 1. Every datetime this file WRITES is a quoted string. Obsidian's YAML
 *    parser turns an unquoted `2026-02-13T09:00` into a native Date, and
 *    a Date read back through readDateLike() loses its time entirely (see
 *    trail-core's readDateTimeLike() doc comment). Quoting on the
 *    way out means a note this plugin wrote always round-trips as a string.
 *    stringifyYaml() quotes these for us because they contain a colon;
 *    isoDateTimeValue() below makes that explicit rather than incidental.
 *
 * 2. Optional fields are OMITTED, never written empty. A day trip's note
 *    carries no `nights:` or `transport:` key at all rather than two empty
 *    lists.
 */
import {
  normalizeCurrency,
  readDateLike,
  readDateTimeLike,
  readNumberLike,
  readString,
  toWikilink,
  wikilinkTarget,
  wikilinkTargets,
} from '@technosoftware/trail-core';
import { CostUnit, FALLBACK_COST_UNIT, parseCostUnit } from './costs/line-cost';
import { clockTime } from './relative-days';

/**
 * The fixed Travel Status vocabulary. Unlike every property NAME the
 * plugin reads, these are property VALUES, and the dashboard's status counts,
 * trip ordering and next-trip countdown all key off these exact strings --
 * so they are deliberately not configurable. See
 * docs/design/data-model.md's note on the names/values distinction.
 */
export const TRAVEL_STATUS_VALUES = ['Planned', 'Booked', 'Over', 'Cancelled'] as const;
export type TravelStatusValue = (typeof TRAVEL_STATUS_VALUES)[number];

export function isTravelStatusValue(value: unknown): value is TravelStatusValue {
  return (
    typeof value === 'string' && (TRAVEL_STATUS_VALUES as readonly string[]).includes(value.trim())
  );
}

/** One itinerary entry. `place` may point at a City or any of the four place types -- see parseTripRecord's own note on why those share one bucket. */
export interface TripStopInput {
  placeTitle: string;
  /** Which day of the trip, for a stop on a trip that has no dates yet. Null for a stop that names its own date. */
  day: number | null;
  /** `HH:mm` when `day` is set, "YYYY-MM-DDTHH:mm" when it is not, null for a stop with no recorded time. */
  from: string | null;
  to: string | null;
  note: string | null;
  /** 1-5 for this visit specifically, or null. */
  rating: number | null;
  /**
   * Which motif this stop is for, when the place is a photo spot.
   *
   * A name rather than an index: motifs are reordered from the block, and
   * an index would silently come to mean a different picture. An unmatched
   * name is kept and shown, the same way an unresolved place link is.
   */
  motifName: string | null;
  /** What this stop is expected to cost: an entry, a guide, a cable car. */
  cost: number | null;
  currency: string | null;
  costUnit: CostUnit;
  /** Who is on it. Empty means everybody on the trip, which is what most stops mean. */
  persons: string[];
}

export interface TripNightInput {
  accommodationTitle: string;
  /** Which day of the trip the stay begins and ends on, for a trip that has no dates yet. */
  checkInDay: number | null;
  checkOutDay: number | null;
  /** Date-only ("YYYY-MM-DD") -- a check-in time isn't information anyone keeps. */
  checkIn: string | null;
  checkOut: string | null;
  cost: number | null;
  currency: string | null;
  costUnit: CostUnit;
  persons: string[];
}

export type TripLegDirection = 'outbound' | 'inbound';
export const TRIP_LEG_DIRECTIONS = ['outbound', 'inbound'] as const;

/** Transport modes offered by the editor. Free text on read, so a hand-written note may carry anything. */
export const TRIP_LEG_MODES = ['train', 'plane', 'car', 'bus', 'boat', 'other'] as const;

export interface TripLegInput {
  direction: TripLegDirection;
  mode: string | null;
  /** Who runs it: an airline, a railway, a named train. */
  carrier: string | null;
  /** Which day of the trip the leg leaves and arrives on. Two, because an overnight leg is ordinary. */
  day: number | null;
  toDay: number | null;
  /** `HH:mm` when `day` is set, "YYYY-MM-DDTHH:mm" when it is not. */
  from: string | null;
  to: string | null;
  reference: string | null;
  origin: string | null;
  destination: string | null;
  cost: number | null;
  currency: string | null;
  costUnit: CostUnit;
  persons: string[];
}

/**
 * Every property name the Trip schema touches, resolved from settings by
 * the caller. Grouped into its own interface (rather than ~20 loose
 * parameters) because both the builder and the parser need the identical
 * set, and a mismatch between them is exactly the bug a round-trip test
 * is meant to catch.
 */
export interface TripPropertyNames {
  typePropertyName: string;
  /**
   * What the trip is, under what it is called. `Zugreise in Suedafrika` under
   * `SHONGOLOLO-EXPRESS - DUNE EXPRESS`: the title is a name and the subtitle
   * says what kind of thing it names.
   */
  subtitleProperty: string;
  /**
   * The one picture that stands for the trip.
   *
   * **This was a hardcoded `image` key** read in the gallery card and nowhere
   * else, with the data model calling it cosmetic and hand-edited. It is a
   * setting now like every other vault-facing name here, which is what lets a
   * form offer it.
   */
  imageProperty: string;
  /** What somebody would put on a brochure: a list of lines, in the order they should read. */
  highlightsProperty: string;
  galleryProperty: string;
  galleryImageField: string;
  galleryCaptionField: string;
  countryProperty: string;
  citiesProperty: string;
  departureProperty: string;
  returnProperty: string;
  travelTypeProperty: string;
  travelStatusProperty: string;
  reviewStatusProperty: string;
  ratingProperty: string;
  createdProperty: string;
  modifiedProperty: string;
  personsProperty: string;
  /**
   * What a day of the trip is called, and what it says for itself.
   *
   * **Sparse**: only a day that wants a title or a paragraph has an entry, and
   * every stop stays exactly where it is. A day is still derived from the
   * items on it -- this annotates one rather than owning it, which is what
   * keeps "1. Tag: Pretoria" from meaning that every stop has to belong to a
   * day object.
   */
  daysProperty: string;
  dayNumberField: string;
  dayTitleField: string;
  dayNoteField: string;
  stopsProperty: string;
  stopPlaceField: string;
  /**
   * Which day of the trip a stop is on, counted from the departure.
   *
   * What lets an itinerary exist before anybody knows the dates: a brochure
   * is twelve numbered days and no calendar. See `relative-days.ts`. When it
   * is set, `stopFromField` and `stopToField` carry a bare `HH:mm` rather
   * than a datetime.
   */
  stopDayField: string;
  stopFromField: string;
  stopToField: string;
  stopNoteField: string;
  stopRatingField: string;
  stopMotifField: string;
  stopCostField: string;
  stopCurrencyField: string;
  stopCostUnitField: string;
  stopPersonsField: string;
  nightsProperty: string;
  nightAccommodationField: string;
  /** Which day of the trip a stay begins and ends on, for a trip that has no dates yet. */
  nightCheckInDayField: string;
  nightCheckOutDayField: string;
  nightCheckInField: string;
  nightCheckOutField: string;
  nightCostField: string;
  nightCurrencyField: string;
  nightCostUnitField: string;
  nightPersonsField: string;
  transportProperty: string;
  legDirectionField: string;
  /**
   * Who runs the leg: Swiss, Edelweiss, Rovos Rail.
   *
   * Free text read down from a wikilink, the same rule `legOriginField` and
   * `legDestinationField` follow and for the same reason -- most airlines will
   * never be a note in anybody's vault, and a field that insisted on one is a
   * field nobody fills in. A named train and the company running it are the
   * same answer often enough that they share the field.
   */
  legCarrierField: string;
  legModeField: string;
  /**
   * Which day of the trip a leg leaves and arrives on.
   *
   * Two of them where a stop has one, because a leg crossing midnight is
   * ordinary rather than exotic -- an overnight flight is the commonest leg
   * there is. A leg that leaves the evening before day one is day 0, which
   * `relative-days.ts` allows on purpose.
   */
  legDayField: string;
  legToDayField: string;
  legFromField: string;
  legToField: string;
  legReferenceField: string;
  legOriginField: string;
  legDestinationField: string;
  legCostField: string;
  legCurrencyField: string;
  legCostUnitField: string;
  legPersonsField: string;
  /** The trip's own money: which currency it plans in, its per-category ceiling, and the rates it converts foreign bookings at. */
  tripCurrencyProperty: string;
  budgetProperty: string;
  budgetCategoryField: string;
  budgetAmountField: string;
  ratesProperty: string;
  rateCurrencyField: string;
  rateValueField: string;
}

/** What one day of the trip is called, and the paragraph it carries. */
export interface TripDayInput {
  day: number;
  title: string | null;
  note: string | null;
}

/** One picture in a trip's gallery: what to show, and what to say about it. */
export interface TripGalleryInput {
  image: string;
  caption: string | null;
}

export interface TripFrontmatterInput {
  properties: TripPropertyNames;
  typeValue: string;
  subtitle: string | null;
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
  /**
   * Stamped once, by creation only -- see vault/note-stamps.ts for the
   * create-once / update-always split. An edit passes null here, and
   * because createdProperty is deliberately absent from tripManagedKeys()
   * the value already in the note survives untouched.
   */
  created: string | null;
  /** Stamped by every edit; null on creation, so a brand-new note carries only `created`. */
  modified: string | null;
  personTitles: string[];
  days: TripDayInput[];
  stops: TripStopInput[];
  nights: TripNightInput[];
  transport: TripLegInput[];
  /** ISO code, or null to inherit the `homeCurrency` setting. */
  currency: string | null;
  budget: TripBudgetInput[];
  rates: TripRateInput[];
}

/** Undefined as well as null, because a stop assembled by hand may leave an optional sub-key off rather than pass null for it. */
/**
 * A place as written on a transport leg: a wikilink read down to its target,
 * or the plain text as typed.
 *
 * Both shapes are ordinary here. "Zürich" is a City the vault probably has a
 * note for; "OR Tambo, Johannesburg" is a place it never will, and a field
 * that accepted only the first would be a field nobody fills in.
 */
function placeLabel(value: unknown): string | null {
  return wikilinkTarget(value) ?? readString(value);
}

/**
 * A day number as it should appear on an entry, or null.
 *
 * Undefined as well as null, for the reason `cleanString` below takes it: an
 * entry assembled by hand, or by a caller written before day numbers existed,
 * leaves the sub-key off rather than passing null for it. Reading `undefined`
 * as "there is a day here" wrote an empty transport leg that should have been
 * dropped, and sent every such stop down the relative branch on the way back
 * in.
 */
function cleanDay(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value;
}

function cleanString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * The four cost sub-keys a stop, a night and a leg all write the same way.
 *
 * The unit is written whenever there is a figure, including when it is
 * `total`. Silence already means total on read, so this is redundant -- and
 * deliberately so: the difference between 890 per person and 890 for the
 * party is the difference between a right budget and a wrong one, and a note
 * that says which is a note nobody has to remember about.
 *
 * Zero is a real estimate: a flight on points still belongs on the plan, and
 * it is not the same fact as a leg nobody has priced.
 */
function writeLineCost(
  entry: Record<string, unknown>,
  // Every field is optional on the way in for the reason cleanString() takes
  // undefined: a line assembled by hand, or by an older caller, leaves a
  // sub-key off rather than passing null for it, and a note write is not the
  // place to throw over it.
  line: {
    cost?: number | null;
    currency?: string | null;
    costUnit?: CostUnit;
    persons?: string[];
  },
  fields: { cost: string; currency: string; unit: string; persons: string }
): void {
  if (line.cost !== null && line.cost !== undefined) {
    entry[fields.cost] = line.cost;
    entry[fields.unit] = line.costUnit ?? FALLBACK_COST_UNIT;
  }
  const currency = cleanString(line.currency);
  if (currency) entry[fields.currency] = currency.toUpperCase();
  // Empty means everybody on the trip, so an empty list is written as
  // nothing at all rather than as an empty list, and a person who joins the
  // trip later joins every line that never disagreed with it.
  const persons = (line.persons ?? [])
    .map((person) => cleanString(person))
    .filter((p2) => p2 !== null);
  if (persons.length > 0) entry[fields.persons] = persons.map((person) => toWikilink(person));
}

/**
 * A datetime as it should appear in frontmatter. The value is already a
 * string by the time it gets here; this exists so the "datetimes are
 * written as strings, never as bare YAML timestamps" rule is a named,
 * greppable decision rather than something that merely happens to be true
 * of the current call sites. See this file's header comment.
 */
function isoDateTimeValue(value: string | null): string | null {
  return cleanString(value);
}

/**
 * Builds the plain frontmatter object for a Trip note -- not a YAML
 * string, so callers and tests can inspect it directly (the App-dependent
 * side runs it through stringifyYaml()). Same shape and same
 * omit-when-absent rule as buildOrderFrontmatter().
 */
export function buildTripFrontmatter(input: TripFrontmatterInput): Record<string, unknown> {
  const p = input.properties;
  const yaml: Record<string, unknown> = { [p.typePropertyName]: input.typeValue };

  // Directly after `type`, matching every other note this plugin creates.
  // A blank property name means the vault asked for no stamp at all, so
  // nothing is written rather than a key with an empty name.
  const created = cleanString(input.created);
  if (created && p.createdProperty) yaml[p.createdProperty] = created;

  const subtitle = cleanString(input.subtitle);
  if (subtitle) yaml[p.subtitleProperty] = subtitle;
  const image = cleanString(input.image);
  if (image) yaml[p.imageProperty] = image;

  // Blank lines dropped rather than written: a highlight nobody typed is not a
  // highlight, and an empty string in the list would print as an empty bullet.
  const highlights = input.highlights
    .map(cleanString)
    .filter((line): line is string => line !== null);
  if (highlights.length > 0) yaml[p.highlightsProperty] = highlights;

  // A gallery entry with no picture is nothing at all, whatever its caption.
  const gallery = input.gallery
    .filter((picture) => cleanString(picture.image) !== null)
    .map((picture) => {
      const entry: Record<string, unknown> = { [p.galleryImageField]: picture.image.trim() };
      const caption = cleanString(picture.caption);
      if (caption) entry[p.galleryCaptionField] = caption;
      return entry;
    });
  if (gallery.length > 0) yaml[p.galleryProperty] = gallery;

  if (input.countryTitle) yaml[p.countryProperty] = toWikilink(input.countryTitle);
  if (input.cityTitles.length > 0) yaml[p.citiesProperty] = input.cityTitles.map(toWikilink);

  const departure = isoDateTimeValue(input.departure);
  const returnDate = isoDateTimeValue(input.return);
  if (departure) yaml[p.departureProperty] = departure;
  if (returnDate) yaml[p.returnProperty] = returnDate;

  const travelType = cleanString(input.travelType);
  if (travelType) yaml[p.travelTypeProperty] = travelType;
  if (input.travelStatus) yaml[p.travelStatusProperty] = input.travelStatus;
  const reviewStatus = cleanString(input.reviewStatus);
  if (reviewStatus) yaml[p.reviewStatusProperty] = reviewStatus;
  if (input.rating !== null) yaml[p.ratingProperty] = input.rating;

  if (input.personTitles.length > 0) yaml[p.personsProperty] = input.personTitles.map(toWikilink);

  // A day entry that says neither a title nor a paragraph annotates nothing,
  // and is dropped like a budget line with no category. The day number alone
  // is not an annotation; it is the key one is filed under.
  const days = input.days
    .filter((day) => cleanString(day.title) !== null || cleanString(day.note) !== null)
    .map((day) => {
      const entry: Record<string, unknown> = { [p.dayNumberField]: day.day };
      const title = cleanString(day.title);
      const note = cleanString(day.note);
      if (title) entry[p.dayTitleField] = title;
      if (note) entry[p.dayNoteField] = note;
      return entry;
    });
  if (days.length > 0) yaml[p.daysProperty] = days;

  // A stop is kept when it names a place **or** carries a note. It used to
  // need a place -- "the place IS the stop" -- which was right for the
  // itinerary this schema was designed around, where every entry is a visit
  // somewhere. A brochure day is not that: "16.30 Uhr: Der Nachmittagstee
  // wird im Beobachtungswagen serviert" happens on a moving train and is the
  // content of the day rather than a visit to anything.
  //
  // What has not changed is the half of the old rule that was doing the
  // work: an entry carrying only a time still says nothing, and is still
  // dropped. Every sub-key is omitted individually when absent, the place
  // included now.
  const stops = input.stops
    .filter((stop) => cleanString(stop.placeTitle) !== null || cleanString(stop.note) !== null)
    .map((stop) => {
      const entry: Record<string, unknown> = {};
      const place = cleanString(stop.placeTitle);
      if (place) entry[p.stopPlaceField] = toWikilink(place);
      const from = isoDateTimeValue(stop.from);
      const to = isoDateTimeValue(stop.to);
      const note = cleanString(stop.note);
      // Before the times, because a reader has to see the day to know how to
      // read them, and a note is read by people as well as by the parser.
      const stopDay = cleanDay(stop.day);
      if (stopDay !== null) entry[p.stopDayField] = stopDay;
      if (from) entry[p.stopFromField] = from;
      if (to) entry[p.stopToField] = to;
      if (note) entry[p.stopNoteField] = note;
      if (stop.rating !== null) entry[p.stopRatingField] = stop.rating;
      const motif = cleanString(stop.motifName);
      if (motif) entry[p.stopMotifField] = motif;
      writeLineCost(entry, stop, {
        cost: p.stopCostField,
        currency: p.stopCurrencyField,
        unit: p.stopCostUnitField,
        persons: p.stopPersonsField,
      });
      return entry;
    });
  if (stops.length > 0) yaml[p.stopsProperty] = stops;

  // The trip's own money. A budget line with no category is dropped on
  // write, like a stop with no place: the category IS the line, and a
  // nameless ceiling belongs to nothing.
  const budget = input.budget
    .filter((line) => cleanString(line.category) !== null && line.amount !== null)
    .map((line) => ({
      [p.budgetCategoryField]: line.category.trim(),
      [p.budgetAmountField]: line.amount,
    }));
  if (budget.length > 0) yaml[p.budgetProperty] = budget;

  const rates = input.rates
    .filter((rate) => cleanString(rate.currency) !== null && rate.rate !== null)
    .map((rate) => ({
      [p.rateCurrencyField]: rate.currency.trim().toUpperCase(),
      [p.rateValueField]: rate.rate,
    }));
  if (rates.length > 0) yaml[p.ratesProperty] = rates;

  const currency = cleanString(input.currency);
  if (currency) yaml[p.tripCurrencyProperty] = currency.toUpperCase();

  const nights = input.nights
    .filter((night) => cleanString(night.accommodationTitle) !== null)
    .map((night) => {
      const entry: Record<string, unknown> = {
        [p.nightAccommodationField]: toWikilink(night.accommodationTitle.trim()),
      };
      const checkIn = cleanString(night.checkIn);
      const checkOut = cleanString(night.checkOut);
      const checkInDay = cleanDay(night.checkInDay);
      const checkOutDay = cleanDay(night.checkOutDay);
      if (checkInDay !== null) entry[p.nightCheckInDayField] = checkInDay;
      if (checkOutDay !== null) entry[p.nightCheckOutDayField] = checkOutDay;
      if (checkIn) entry[p.nightCheckInField] = checkIn;
      if (checkOut) entry[p.nightCheckOutField] = checkOut;
      writeLineCost(entry, night, {
        cost: p.nightCostField,
        currency: p.nightCurrencyField,
        unit: p.nightCostUnitField,
        persons: p.nightPersonsField,
      });
      return entry;
    });
  if (nights.length > 0) yaml[p.nightsProperty] = nights;

  // A leg is worth keeping only if it says something beyond its own
  // direction, which the editor always supplies -- otherwise saving a
  // trip after merely opening the Transport section would write two
  // content-free entries.
  const transport = input.transport
    .filter(
      (leg) =>
        cleanString(leg.mode) !== null ||
        cleanString(leg.carrier) !== null ||
        cleanDay(leg.day) !== null ||
        cleanDay(leg.toDay) !== null ||
        isoDateTimeValue(leg.from) !== null ||
        isoDateTimeValue(leg.to) !== null ||
        cleanString(leg.reference) !== null ||
        cleanString(leg.origin) !== null ||
        cleanString(leg.destination) !== null ||
        leg.cost !== null ||
        (leg.persons?.length ?? 0) > 0
    )
    .map((leg) => {
      const entry: Record<string, unknown> = { [p.legDirectionField]: leg.direction };
      const mode = cleanString(leg.mode);
      const from = isoDateTimeValue(leg.from);
      const to = isoDateTimeValue(leg.to);
      const reference = cleanString(leg.reference);
      const carrier = cleanString(leg.carrier);
      if (carrier) entry[p.legCarrierField] = carrier;
      if (mode) entry[p.legModeField] = mode;
      const legDay = cleanDay(leg.day);
      const legToDay = cleanDay(leg.toDay);
      if (legDay !== null) entry[p.legDayField] = legDay;
      if (legToDay !== null) entry[p.legToDayField] = legToDay;
      if (from) entry[p.legFromField] = from;
      if (to) entry[p.legToField] = to;
      if (reference) entry[p.legReferenceField] = reference;
      const origin = cleanString(leg.origin);
      const destination = cleanString(leg.destination);
      if (origin) entry[p.legOriginField] = origin;
      if (destination) entry[p.legDestinationField] = destination;
      writeLineCost(entry, leg, {
        cost: p.legCostField,
        currency: p.legCurrencyField,
        unit: p.legCostUnitField,
        persons: p.legPersonsField,
      });
      return entry;
    });
  if (transport.length > 0) yaml[p.transportProperty] = transport;

  const modified = cleanString(input.modified);
  if (modified && p.modifiedProperty) yaml[p.modifiedProperty] = modified;

  return yaml;
}

/**
 * Every frontmatter key the Trip schema owns -- used by updateTripNote() to
 * clear stale keys without touching frontmatter a user hand-added outside
 * this schema.
 *
 * `createdProperty` is deliberately NOT in this list, and must not be added
 * to it. These keys are deleted before a rewrite, and an edit never re-emits
 * `created`, so listing it here would quietly strip the creation stamp off
 * every trip the first time it was saved.
 */
export function tripManagedKeys(p: TripPropertyNames): string[] {
  return [
    p.typePropertyName,
    p.subtitleProperty,
    p.imageProperty,
    p.highlightsProperty,
    p.galleryProperty,
    p.countryProperty,
    p.citiesProperty,
    p.departureProperty,
    p.returnProperty,
    p.travelTypeProperty,
    p.travelStatusProperty,
    p.reviewStatusProperty,
    p.ratingProperty,
    p.modifiedProperty,
    p.personsProperty,
    p.daysProperty,
    p.stopsProperty,
    p.nightsProperty,
    p.transportProperty,
    p.tripCurrencyProperty,
    p.budgetProperty,
    p.ratesProperty,
  ];
}

/**
 * A list of plain strings, for a property whose entries are text rather than
 * maps. A single string reads as a list of one, because somebody who typed
 * `highlights: Nostalgische Zugreise` meant one highlight rather than nothing.
 */
function readLines(raw: unknown): string[] {
  if (typeof raw === 'string') return readString(raw) ? [raw.trim()] : [];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => readString(entry)).filter((line): line is string => line !== null);
}

/** Frontmatter list entries, as plain records -- anything that isn't an object is skipped rather than coerced. */
function objectEntries(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null
  );
}

/** A day's own title and paragraph, as the note carries them. */
export interface ParsedTripDay {
  day: number;
  title: string | null;
  note: string | null;
}

export interface ParsedTripStop {
  /** Which day of the trip, or null for a stop that names its own date. See `relative-days.ts`. */
  day: number | null;
  /** True when the entry names a place that did not parse, as against naming none at all. A typo has to stay visible; a line that is only a time and a sentence has nothing to warn about. */
  placeUnresolved: boolean;
  placeTitle: string | null;
  from: string | null;
  to: string | null;
  note: string | null;
  rating: number | null;
  motifName: string | null;
  cost: number | null;
  currency: string | null;
  costUnit: CostUnit;
  persons: string[];
}

export interface ParsedTripNight {
  /** Which day of the trip the stay begins and ends on, or null for one that names its own dates. */
  checkInDay: number | null;
  checkOutDay: number | null;
  accommodationTitle: string | null;
  checkIn: string | null;
  checkOut: string | null;
  /** What the stay is expected to cost, while it is still being planned. Null until somebody prices it, which is not zero. */
  cost: number | null;
  currency: string | null;
  /** What that figure is per: a room per night, the whole stay, or a bed per person. */
  costUnit: CostUnit;
  /** Who the stay is for. Empty means everybody on the trip; two people is what makes it a double room. */
  persons: string[];
}

/** One category's ceiling. The plan, in the trip's own currency; the bookings are the actuals it is compared against. */
export interface ParsedTripBudgetLine {
  category: string;
  amount: number | null;
}

/** One conversion rate, as the user typed it. Never fetched, never cached, and always shown beside the figure it converted. */
export interface ParsedTripRate {
  currency: string;
  rate: number | null;
}

export interface TripBudgetInput {
  category: string;
  amount: number | null;
}

export interface TripRateInput {
  currency: string;
  rate: number | null;
}

export interface ParsedTripLeg {
  /** Which day of the trip the leg leaves and arrives on, or null for one that names its own dates. */
  day: number | null;
  toDay: number | null;
  /** Who runs it, as written: a wikilink read down to its target, or the plain text. */
  carrier: string | null;
  direction: TripLegDirection;
  mode: string | null;
  from: string | null;
  to: string | null;
  reference: string | null;
  /**
   * Where the leg starts and ends, as written.
   *
   * A wikilink is read down to its target, so `[[Zürich]]` and `Zürich`
   * both arrive as `Zürich` and the renderer can link the ones the vault
   * actually has a note for. Most airports never will, and a leg that
   * insisted on a note for Pretoria would be a leg nobody fills in.
   */
  origin: string | null;
  destination: string | null;
  cost: number | null;
  currency: string | null;
  /** What the figure is per. A ticket is quoted per passenger, so two people on a leg is two fares. */
  costUnit: CostUnit;
  persons: string[];
}

/** One picture in a trip's gallery, as the note carries it. */
export interface ParsedTripPicture {
  image: string;
  caption: string | null;
}

export interface ParsedTripRecord {
  subtitle: string | null;
  image: string | null;
  highlights: string[];
  gallery: ParsedTripPicture[];
  countryTitle: string | null;
  cityTitles: string[];
  departure: string | null;
  return: string | null;
  travelType: string | null;
  /** Exactly as written, when it's one of the four known values -- null for absent OR unrecognized. See effectiveTravelStatus() for the derived fallback. */
  travelStatus: TravelStatusValue | null;
  reviewStatus: string | null;
  rating: number | null;
  personTitles: string[];
  days: ParsedTripDay[];
  stops: ParsedTripStop[];
  nights: ParsedTripNight[];
  transport: ParsedTripLeg[];
  currency: string | null;
  budget: ParsedTripBudgetLine[];
  rates: ParsedTripRate[];
}

export interface ParseTripRecordInput {
  properties: TripPropertyNames;
  frontmatter: Record<string, unknown>;
}

/**
 * The mirror image of buildTripFrontmatter() -- turns one note's
 * frontmatter back into a structured record. Pure, so it can be
 * unit-tested by round-tripping the builder's own output rather than
 * against a hand-written fixture that could drift from what's really
 * written.
 *
 * A stop whose `place` doesn't parse as a wikilink is KEPT with a null
 * placeTitle rather than dropped, unlike on the write side. On read, a
 * malformed entry is a note that needs fixing and should stay visible in
 * the itinerary as an unresolved row; silently dropping it would make a
 * typo look like deletion.
 */
export function parseTripRecord(input: ParseTripRecordInput): ParsedTripRecord {
  const p = input.properties;
  const fm = input.frontmatter;

  const rawStatus = readString(fm[p.travelStatusProperty]);

  return {
    subtitle: readString(fm[p.subtitleProperty]),
    image: readString(fm[p.imageProperty]),
    highlights: readLines(fm[p.highlightsProperty]),
    gallery: objectEntries(fm[p.galleryProperty]).flatMap((entry) => {
      const image = readString(entry[p.galleryImageField]);
      return image ? [{ image, caption: readString(entry[p.galleryCaptionField]) }] : [];
    }),
    countryTitle: wikilinkTarget(fm[p.countryProperty]),
    cityTitles: wikilinkTargets(fm[p.citiesProperty]),
    departure: readDateTimeLike(fm[p.departureProperty]),
    return: readDateTimeLike(fm[p.returnProperty]),
    travelType: readString(fm[p.travelTypeProperty]),
    travelStatus: isTravelStatusValue(rawStatus) ? (rawStatus.trim() as TravelStatusValue) : null,
    reviewStatus: readString(fm[p.reviewStatusProperty]),
    rating: readNumberLike(fm[p.ratingProperty]),
    personTitles: wikilinkTargets(fm[p.personsProperty]),
    // An entry with no day number annotates nothing, so it is dropped rather
    // than kept as a day nobody could find.
    days: objectEntries(fm[p.daysProperty]).flatMap((entry) => {
      const day = readNumberLike(entry[p.dayNumberField]);
      return day === null
        ? []
        : [
            {
              day,
              title: readString(entry[p.dayTitleField]),
              note: readString(entry[p.dayNoteField]),
            },
          ];
    }),
    stops: objectEntries(fm[p.stopsProperty]).map((entry) => {
      // The day number is what marks a stop as relative, and it decides how
      // its two endpoints are read: a bare clock time rather than a datetime.
      // Reading the wrong one would not throw, it would quietly return null
      // and drop the time, which is why the branch is here rather than in a
      // reader clever enough to guess.
      const day = readNumberLike(entry[p.stopDayField]);
      const place = entry[p.stopPlaceField];
      return {
        day,
        placeTitle: wikilinkTarget(place),
        // A stop that names no place and a stop whose link is a typo both
        // read as a null title, and they are not the same thing: the first
        // is a line of a brochure day, the second is a note that needs
        // fixing. Without the difference every placeless line would render
        // as "unresolved link", which is the noise version of the warning it
        // was meant to be.
        placeUnresolved: wikilinkTarget(place) === null && readString(place) !== null,
        from:
          day === null
            ? readDateTimeLike(entry[p.stopFromField])
            : clockTime(readString(entry[p.stopFromField])),
        to:
          day === null
            ? readDateTimeLike(entry[p.stopToField])
            : clockTime(readString(entry[p.stopToField])),
        note: readString(entry[p.stopNoteField]),
        rating: readNumberLike(entry[p.stopRatingField]),
        motifName: readString(entry[p.stopMotifField]),
        cost: readNumberLike(entry[p.stopCostField]),
        currency: normalizeCurrency(readString(entry[p.stopCurrencyField])),
        costUnit: parseCostUnit(readString(entry[p.stopCostUnitField])),
        persons: wikilinkTargets(entry[p.stopPersonsField]),
      };
    }),
    nights: objectEntries(fm[p.nightsProperty]).map((entry) => ({
      accommodationTitle: wikilinkTarget(entry[p.nightAccommodationField]),
      checkInDay: readNumberLike(entry[p.nightCheckInDayField]),
      checkOutDay: readNumberLike(entry[p.nightCheckOutDayField]),
      checkIn: readDateLike(entry[p.nightCheckInField]),
      checkOut: readDateLike(entry[p.nightCheckOutField]),
      cost: readNumberLike(entry[p.nightCostField]),
      currency: normalizeCurrency(readString(entry[p.nightCurrencyField])),
      costUnit: parseCostUnit(readString(entry[p.nightCostUnitField])),
      persons: wikilinkTargets(entry[p.nightPersonsField]),
    })),
    currency: normalizeCurrency(readString(fm[p.tripCurrencyProperty])),
    budget: objectEntries(fm[p.budgetProperty]).map((entry) => ({
      category: readString(entry[p.budgetCategoryField]) ?? '',
      amount: readNumberLike(entry[p.budgetAmountField]),
    })),
    rates: objectEntries(fm[p.ratesProperty]).map((entry) => ({
      currency: normalizeCurrency(readString(entry[p.rateCurrencyField])) ?? '',
      rate: readNumberLike(entry[p.rateValueField]),
    })),
    transport: objectEntries(fm[p.transportProperty]).map((entry) => {
      // A leg is relative when it names a day for either end: an overnight
      // flight may say `day: 0` and arrive on `toDay: 1`, and one that names
      // only the day it leaves still carries a clock time rather than a date.
      const day = readNumberLike(entry[p.legDayField]);
      const toDay = readNumberLike(entry[p.legToDayField]);
      const relative = day !== null || toDay !== null;
      return {
        day,
        toDay,
        // Anything that isn't explicitly "inbound" is treated as outbound.
        // A leg has to have some direction to render under, and outbound is
        // the one a partially-filled note most likely means.
        direction: readString(entry[p.legDirectionField]) === 'inbound' ? 'inbound' : 'outbound',
        mode: readString(entry[p.legModeField]),
        // A wikilink reads down to its target, like a leg's own origin:
        // `[[Swiss]]` and `Swiss` arrive the same, and neither needs a note.
        carrier: placeLabel(entry[p.legCarrierField]),
        from: relative
          ? clockTime(readString(entry[p.legFromField]))
          : readDateTimeLike(entry[p.legFromField]),
        to: relative
          ? clockTime(readString(entry[p.legToField]))
          : readDateTimeLike(entry[p.legToField]),
        reference: readString(entry[p.legReferenceField]),
        // A wikilink reads down to its target so `[[Zürich]]` and `Zürich`
        // arrive the same, and the renderer links whichever the vault has a
        // note for. Most airports never will.
        origin: placeLabel(entry[p.legOriginField]),
        destination: placeLabel(entry[p.legDestinationField]),
        cost: readNumberLike(entry[p.legCostField]),
        currency: normalizeCurrency(readString(entry[p.legCurrencyField])),
        costUnit: parseCostUnit(readString(entry[p.legCostUnitField])),
        persons: wikilinkTargets(entry[p.legPersonsField]),
      };
    }),
  };
}

/**
 * The status a trip should be treated as having, deriving one when the
 * note carries none.
 *
 * Without this, a trip note whose author never typed a `travelStatus:`
 * disappears from the dashboard's Trips section and counts for nothing in
 * the stats row -- which is not a hypothetical: it is the state every trip
 * in the reference vault was in (see
 * the sample vault's own trip notes). Deriving is strictly
 * better than the alternative of writing a status into every note on
 * read, which would mean the plugin editing notes nobody asked it to
 * edit.
 *
 * `today` is injected rather than read from the clock so this stays pure
 * and testable.
 *
 * Note the asymmetry: a trip already in the past is definitively `Over`,
 * but a future trip could be either `Planned` or `Booked`, and the
 * difference is a fact about the world that no date can reveal -- so the
 * optimistic half of the guess is deliberately the weaker one.
 */
export function effectiveTravelStatus(
  record: Pick<ParsedTripRecord, 'travelStatus' | 'departure' | 'return'>,
  today: string
): TravelStatusValue {
  if (record.travelStatus) return record.travelStatus;
  const end = record.return ?? record.departure;
  if (end && end.slice(0, 10) < today) return 'Over';
  return 'Planned';
}
