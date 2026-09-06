/**
 * One set of defaults for the shapes every suite here builds by hand.
 *
 * Five files each had their own `stop()` and four their own `trip()`, and they
 * drifted independently: when the trip schema grew a field, every one of them
 * silently kept producing objects without it. The compiler said nothing,
 * because `tests/` was not in the typecheck; the suites went on passing while
 * quietly testing an older shape.
 *
 * That happened twice in one day -- `PROPS` in `trip-note.test.ts` carried
 * `undefined` for five settings added that morning, so the suite meant to
 * cover them covered nothing. Putting `tests/` in the typecheck is what
 * catches it; putting the defaults in one place is what makes the fix one
 * edit instead of twenty-five.
 *
 * **Every builder is complete on purpose.** A `Partial<T>` spread over a full
 * default is the only shape that keeps failing loudly when `T` grows: a
 * builder that itself took a partial would compile forever and go on lying.
 */
import { TFile } from 'obsidian';
import {
  ParsedTripDay,
  ParsedTripLeg,
  ParsedTripVariant,
  ParsedTripNight,
  ParsedTripStop,
  TripLegInput,
  TripNightInput,
  TripStopInput,
} from '../src/trips/trip-note';
import {
  TravelBoard,
  TravelTrip,
  TravelTripLeg,
  TravelVehicle,
  TravelTripNight,
  TravelTripStop,
} from '../src/vault/types';

/** A file that is only a path and a basename, which is all any of this reads. */
export function aFile(basename: string): TFile {
  return { path: `${basename}.md`, basename } as TFile;
}

// ── What a note says ─────────────────────────────────────────────────────

export function aParsedStop(over: Partial<ParsedTripStop> = {}): ParsedTripStop {
  return {
    day: null,
    placeTitle: null,
    placeUnresolved: false,
    from: null,
    to: null,
    note: null,
    rating: null,
    motifName: null,
    cost: null,
    currency: null,
    costUnit: 'total',
    persons: [],
    variants: [],
    optional: false,
    chosen: false,
    ...over,
  };
}

export function aParsedNight(over: Partial<ParsedTripNight> = {}): ParsedTripNight {
  return {
    checkInDay: null,
    checkOutDay: null,
    accommodationTitle: null,
    checkIn: null,
    checkOut: null,
    cost: null,
    currency: null,
    costUnit: 'total',
    persons: [],
    variants: [],
    optional: false,
    chosen: false,
    ...over,
  };
}

/** A fare on a leg, for the tests that need one. The default is a named fare nobody has chosen. */
export function aParsedVariant(over: Partial<ParsedTripVariant> = {}): ParsedTripVariant {
  return {
    name: null,
    description: null,
    cost: null,
    currency: null,
    costUnit: 'person',
    chosen: false,
    ...over,
  };
}

export function aParsedLeg(over: Partial<ParsedTripLeg> = {}): ParsedTripLeg {
  return {
    day: null,
    toDay: null,
    carrier: null,
    vehicleTitle: null,
    direction: 'outbound',
    mode: 'plane',
    from: null,
    to: null,
    reference: null,
    origin: null,
    destination: null,
    cost: null,
    currency: null,
    costUnit: 'total',
    persons: [],
    variants: [],
    optional: false,
    chosen: false,
    ...over,
  };
}

export function aParsedDay(over: Partial<ParsedTripDay> = {}): ParsedTripDay {
  return { day: 1, title: null, note: null, ...over };
}

// ── What a form hands the writer ─────────────────────────────────────────

export function aStopInput(over: Partial<TripStopInput> = {}): TripStopInput {
  return {
    placeTitle: '',
    day: null,
    from: null,
    to: null,
    note: null,
    rating: null,
    motifName: null,
    cost: null,
    currency: null,
    costUnit: 'total',
    persons: [],
    variants: [],
    optional: false,
    chosen: false,
    ...over,
  };
}

export function aNightInput(over: Partial<TripNightInput> = {}): TripNightInput {
  return {
    accommodationTitle: '',
    checkInDay: null,
    checkOutDay: null,
    checkIn: null,
    checkOut: null,
    cost: null,
    currency: null,
    costUnit: 'night',
    persons: [],
    variants: [],
    optional: false,
    chosen: false,
    ...over,
  };
}

export function aLegInput(over: Partial<TripLegInput> = {}): TripLegInput {
  return {
    direction: 'outbound',
    mode: null,
    carrier: null,
    vehicleTitle: null,
    day: null,
    toDay: null,
    from: null,
    to: null,
    reference: null,
    origin: null,
    destination: null,
    cost: null,
    currency: null,
    costUnit: 'person',
    persons: [],
    variants: [],
    optional: false,
    chosen: false,
    ...over,
  };
}

// ── What the board hands a view ──────────────────────────────────────────

/** A stop with its cross-references resolved, as `readTravelBoard` leaves one. */
export function aStop(over: Partial<TravelTripStop> = {}): TravelTripStop {
  return { ...aParsedStop(), target: null, targetKind: null, ...over };
}

export function aNight(over: Partial<TravelTripNight> = {}): TravelTripNight {
  return { ...aParsedNight(), accommodation: null, ...over };
}

export function aLeg(over: Partial<TravelTripLeg> = {}): TravelTripLeg {
  return { ...aParsedLeg(), vehicle: null, ...over };
}

/** A vehicle as the board leaves one: a ship or a named train with its cabins. */
export function aVehicle(title: string, over: Partial<TravelVehicle> = {}): TravelVehicle {
  return {
    file: aFile(title),
    title,
    mode: null,
    operatorTitle: null,
    built: null,
    refurbished: null,
    capacity: null,
    length: null,
    tonnage: null,
    website: null,
    image: null,
    gallery: [],
    cabins: [],
    ...over,
  };
}

export function aTrip(title: string, over: Partial<TravelTrip> = {}): TravelTrip {
  return {
    file: aFile(title),
    title,
    subtitle: null,
    image: null,
    highlights: [],
    gallery: [],
    countryTitle: null,
    country: null,
    cityTitles: [],
    cities: [],
    departure: null,
    return: null,
    travelType: null,
    travelStatus: null,
    effectiveStatus: 'Over',
    reviewStatus: null,
    rating: null,
    personTitles: [],
    days: [],
    stops: [],
    nights: [],
    transport: [],
    currency: null,
    budget: [],
    rates: [],
    ...over,
  };
}

export function aBoard(over: Partial<TravelBoard> = {}): TravelBoard {
  return {
    trips: [],
    vehicles: [],
    bookings: [],
    countries: [],
    states: [],
    cities: [],
    places: [],
    ...over,
  };
}
