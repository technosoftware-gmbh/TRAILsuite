/**
 * The resolved Travel data model -- see docs/design/travel-module-plan.md
 * §3. These are read-time views over the vault's own notes -- nothing here
 * is persisted as plugin state; read-entities.ts rebuilds it from each
 * note's frontmatter plus the wikilink relationships between them.
 *
 * Country/State/City form a genuine three-way cycle (a Country links to
 * its States, a State links back to its Country, a State's Capital and a
 * City's own State/Country links point the other way again), so
 * read-entities.ts builds these in two passes: skeleton objects first,
 * then a second pass that mutates in the resolved cross-references once
 * every skeleton exists. See that file's own doc comment.
 */
import { TFile } from 'obsidian';
import { TravelPlaceType } from './entity-types';
import {
  ParsedTripBudgetLine,
  ParsedTripDay,
  ParsedTripPicture,
  ParsedTripRate,
  TravelStatusValue,
} from '../trips/trip-note';
import { ParsedPhotoSpot } from '../places/photo-spot-note';
import { ParsedBooking } from '../trips/costs/booking-note';
import { CostUnit } from '../trips/costs/line-cost';

/**
 * A photo spot's photography frontmatter, exactly as photo-spot-note.ts
 * parsed it. An alias rather than a second interface: unlike a Trip's
 * stops, nothing in here refers to another note, so there is no resolution
 * pass to add and nothing a parallel Travel* shape would carry that the
 * parsed one does not.
 */
export type TravelPhotoSpotDetail = ParsedPhotoSpot;

export interface TravelCountry {
  file: TFile;
  title: string;
  /** Raw wikilink target from `capital:`, or null if absent/unresolved. */
  capitalTitle: string | null;
  capital: TravelCity | null;
  /** Raw wikilink targets from `states:`. */
  stateTitles: string[];
  states: TravelState[];
}

export interface TravelState {
  file: TFile;
  title: string;
  countryTitle: string | null;
  country: TravelCountry | null;
  capitalTitle: string | null;
  capital: TravelCity | null;
  cityTitles: string[];
  cities: TravelCity[];
}

export interface TravelCity {
  file: TFile;
  title: string;
  countryTitle: string | null;
  country: TravelCountry | null;
  /** Raw wikilink target from `state:` -- null for countries that don't use the State level. */
  stateTitle: string | null;
  state: TravelState | null;
  /** [latitude, longitude] as pasted from a map view, or null if unset. */
  geoLocation: [string, string] | null;
  /** Explicit frontmatter OR derived from a finished trip that stops here -- see vault/visit-derivation.ts. */
  visited: boolean;
  lastVisit: string | null;
  /** True when a finished trip contributed the visit, so the UI can explain a flag the note itself doesn't carry. */
  visitedFromTrips: boolean;
  tags: string[];
}

/**
 * Accommodation/FnB/Landmark/Location share this exact shape (country/city
 * wikilinks, geoLocation, visited/lastVisit, rating) -- see the plan doc's
 * §3 data model table -- discriminated by `kind`. Accommodation and FnB
 * each carry one extra subtype-specific field (accommodationType/
 * accommodationStatus, fnbType respectively), left null for the other
 * kinds rather than modeled as separate interfaces, since every other
 * field is identical and a shared type keeps the gallery/dashboard code
 * that treats all four uniformly from needing four near-duplicate branches.
 */
export interface TravelPlace {
  file: TFile;
  kind: TravelPlaceType;
  title: string;
  countryTitle: string | null;
  country: TravelCountry | null;
  cityTitle: string | null;
  city: TravelCity | null;
  geoLocation: [string, string] | null;
  /** Explicit frontmatter OR derived from a finished trip that stops here -- see vault/visit-derivation.ts. */
  visited: boolean;
  lastVisit: string | null;
  visitedFromTrips: boolean;
  tags: string[];
  /** Street address and website, where the note carries them. Read-only; nothing writes these. */
  address: string | null;
  website: string | null;
  /** 1-5, or null if unrated. */
  rating: number | null;
  /** Set only when kind === 'accommodation'. */
  accommodationType: string | null;
  accommodationStatus: string | null;
  /** Set only when kind === 'fnb'. */
  fnbType: string | null;
  /**
   * Set only when kind === 'photospot', null for the other four.
   *
   * One nullable field rather than eight more on the shared shape: motifs,
   * samples, transit and the five access scalars are useless to an
   * Accommodation, and putting them here flat would make every place carry
   * a photography schema it never fills in. Same instinct as
   * accommodationType/fnbType, one level up. See
   * docs/design/photo-spots.md §2.1.
   */
  photoSpot: TravelPhotoSpotDetail | null;
}

export interface TravelTrip {
  file: TFile;
  title: string;
  /** What the trip is, under what it is called. Null when the note says nothing. */
  subtitle: string | null;
  /** The one picture that stands for it, exactly as the note wrote it: a vault path, a wikilink or a URL. */
  image: string | null;
  /** What somebody would put on a brochure, in the order they should read. */
  highlights: string[];
  /** The pictures, in the order they were chosen. */
  gallery: ParsedTripPicture[];
  countryTitle: string | null;
  country: TravelCountry | null;
  /** The Cities this trip touches -- its geographic scope, independent of whether a city is also an itinerary stop below. */
  cityTitles: string[];
  cities: TravelCity[];
  /** "YYYY-MM-DDTHH:mm" where a time was recorded, "YYYY-MM-DD" otherwise. Null if unset. */
  departure: string | null;
  return: string | null;
  travelType: string | null;
  /** Exactly as written when it is one of the four known values; null for absent or unrecognized. Use effectiveStatus for display and filtering. */
  travelStatus: TravelStatusValue | null;
  /** travelStatus when set, otherwise derived from the trip's dates -- see trip-note.ts's effectiveTravelStatus(). */
  effectiveStatus: TravelStatusValue;
  reviewStatus: string | null;
  /** 1-5, or null if unrated. */
  rating: number | null;
  /** Raw wikilink targets from the trip's persons property, never resolved to files. The trip editor offers whatever crm/persons.ts finds (notes in the one configured Persons folder whose type property matches the configured person type value, optionally narrowed by tag), but a title written by hand is kept exactly as it stands. */
  personTitles: string[];
  /** What each day of the trip is called and says for itself. Sparse: only the days that carry one. */
  days: ParsedTripDay[];
  stops: TravelTripStop[];
  nights: TravelTripNight[];
  transport: TravelTripLeg[];
  /** The currency this trip plans in, or null to inherit the `homeCurrency` setting. */
  currency: string | null;
  /** The plan: a ceiling per category, in the trip's own currency. Compared against the bookings that name this trip. */
  budget: ParsedTripBudgetLine[];
  /** Conversion rates as the user typed them. The plugin never fetches one. */
  rates: ParsedTripRate[];
}

/**
 * An itinerary stop's resolved target. Cities and the four place types
 * share one bucket deliberately: "arrived in Basel at 10:00, ate at the
 * Gifthuettli at 12:00" is one itinerary at two levels of zoom, and the
 * reference vault's own trips already listed both side by side. See
 * docs/design/trip-model-redesign.md §2.4, including the known
 * same-title collision between a City and a place.
 */
export type TravelStopTargetKind = 'city' | TravelPlaceType;

export interface TravelTripStop {
  /** Which day of the trip, or null for a stop that names its own date. Resolved against the trip's departure at render time and never written back -- see trips/relative-days.ts. */
  day: number | null;
  /** True when the entry names a place that did not parse, as against naming none at all. A brochure line is only a time and a sentence; a typo has to stay visible. */
  placeUnresolved: boolean;
  /** Raw wikilink target, or null when the entry's place field was malformed. Kept rather than dropped, so a typo stays visible in the itinerary instead of looking like a deletion. */
  placeTitle: string | null;
  target: TravelCity | TravelPlace | null;
  targetKind: TravelStopTargetKind | null;
  /** "YYYY-MM-DDTHH:mm", or null for a stop with no recorded time. */
  from: string | null;
  to: string | null;
  note: string | null;
  /** 1-5 for this visit specifically. */
  rating: number | null;
  /** Which motif at a photo spot this stop is for, as written. Null for a stop that names none, which is every stop at anything else. */
  motifName: string | null;
  /** What the stop is expected to cost: an entry, a guide, a cable car. */
  cost: number | null;
  currency: string | null;
  /** What that figure is per. See trips/costs/line-cost.ts. */
  costUnit: CostUnit;
  /** Who is on it, as written. Empty means everybody on the trip. */
  persons: string[];
}

export interface TravelTripNight {
  /** Which day of the trip the stay begins and ends on, or null for one that names its own dates. */
  checkInDay: number | null;
  checkOutDay: number | null;
  accommodationTitle: string | null;
  accommodation: TravelPlace | null;
  /** Date-only -- nobody records a check-in clock time. */
  checkIn: string | null;
  checkOut: string | null;
  /** What the stay is expected to cost while it is still being planned. Superseded by a booking sharing this trip once one exists. */
  cost: number | null;
  currency: string | null;
  /** What that figure is per: a room per night, the whole stay, or a bed per person. */
  costUnit: CostUnit;
  /** Who the stay is for. Empty means everybody on the trip; the count is what decides single against double. */
  persons: string[];
}

export interface TravelTripLeg {
  /** Which day of the trip the leg leaves and arrives on, or null for one that names its own dates. */
  day: number | null;
  toDay: number | null;
  /** Who runs it: Swiss, Edelweiss, Rovos Rail. As written. */
  carrier: string | null;
  direction: 'outbound' | 'inbound';
  mode: string | null;
  from: string | null;
  to: string | null;
  reference: string | null;
  /** Where the leg starts and ends, as written: a wikilink target or plain text. */
  origin: string | null;
  destination: string | null;
  /** What the leg is expected to cost, before there is anything to book. Superseded by a booking carrying the same reference. */
  cost: number | null;
  currency: string | null;
  /** What that figure is per. A fare is quoted per passenger, so two people is two tickets. */
  costUnit: CostUnit;
  persons: string[];
}

/**
 * One booking, read out of its note.
 *
 * Nothing here is resolved to another note object, deliberately. A booking
 * names its trip, its supplier and its people by title, and every consumer
 * matches on titles: the costs block finds a trip's bookings by comparing
 * `tripTitle`, and the invoice links by title the way every wikilink in
 * this plugin is followed. Resolving would buy nothing and would put
 * bookings into the board's two-pass cross-referencing for no reason.
 */
export interface TravelBooking extends ParsedBooking {
  file: TFile;
  title: string;
}

export interface TravelBoard {
  trips: TravelTrip[];
  /** Every booking in the vault, in title order. Attached to trips by title rather than by reference; see TravelBooking. */
  bookings: TravelBooking[];
  countries: TravelCountry[];
  states: TravelState[];
  cities: TravelCity[];
  places: TravelPlace[];
}
