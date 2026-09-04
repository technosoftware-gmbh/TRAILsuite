/**
 * Reads the configured Trip/Country/State/City/place-type folders and
 * resolves the geographic-hierarchy relationships into the TravelBoard
 * shape (types.ts). See docs/design/travel-module-plan.md §3.
 *
 * Matching is by title (a note's filename), which is what the wikilinks in
 * the notes themselves point at.
 *
 * Finding the notes of one kind is trail-core's `readNotesOfType()`;
 * resolving what they point at is not, and stays here. See
 * readTravelBoard()'s two-pass note for why.
 */
import { App, TFile } from 'obsidian';
import { APERtrailSettings } from '../settings/types';
import { BookingPropertyNames, parseBooking } from '../trips/costs/booking-note';
import { hostFor } from '../shared/vault-host';
import {
  findValue,
  formatDayTitle,
  readDateLike,
  readNotesOfType,
  readNumberLike,
  readString,
  readStringList,
  wikilinkTarget,
  wikilinkTargets,
  type VaultNote,
} from 'trail-core';
import {
  TRAVEL_PLACE_FOLDER_SETTING,
  TRAVEL_PLACE_TYPES,
  TravelEntityType,
  TravelPlaceType,
} from './entity-types';
import { applyDerivedVisits } from './visit-derivation';
import { bookingReadFolders } from '../trips/trip-folder';
import {
  effectiveTravelStatus,
  ParsedTripRecord,
  parseTripRecord,
  TripPropertyNames,
} from '../trips/trip-note';
import { parsePhotoSpotRecord, photoSpotPropertyNames } from '../places/photo-spot-note';
import {
  TravelBoard,
  TravelCity,
  TravelCountry,
  TravelPlace,
  TravelState,
  TravelStopTargetKind,
  TravelTrip,
  TravelTripNight,
  TravelTripStop,
  TravelBooking,
} from './types';

/**
 * Every note of one travel entity type, with its frontmatter already read.
 *
 * Folder AND type together, which is trail-core's `readNotesOfType()` and
 * the same rule crm/read-crm.ts and the entity-type health check are judged
 * by. A blank folder setting finds nothing rather than claiming the whole
 * vault, which the core's query already does for an empty folder list, so
 * what is left here is only the mapping from APERtrail's settings onto it.
 *
 * The core reads the type value leniently in shape though not in text: a
 * `type:` the property editor has turned into a list still matches, and a
 * wikilink-shaped value is unwrapped. Both are shapes a real vault produces
 * without anybody deciding to, and a note that vanished for either reason
 * was near impossible to attribute.
 */
function travelNotesOfType(
  app: App,
  settings: APERtrailSettings,
  folder: string,
  expectedType: TravelEntityType
): VaultNote<TFile>[] {
  return travelNotesInFolders(app, settings, [folder], expectedType);
}

/**
 * The same, over several folders.
 *
 * Bookings need it: one lives inside its trip's own folder and an older one
 * lives in the flat bookings folder, and a reader that looked in only one of
 * the two would silently lose half of them. Folder matching recurses, so the
 * trips folder covers every trip's own `Bookings/` at once.
 */
function travelNotesInFolders(
  app: App,
  settings: APERtrailSettings,
  folders: string[],
  expectedType: TravelEntityType
): VaultNote<TFile>[] {
  return readNotesOfType(hostFor(app), {
    folders,
    typePropertyName: settings.typePropertyName.trim() || 'type',
    typeValue: expectedType,
  });
}

/**
 * Not trail-core's readBooleanLike(), which returns null for a value it
 * cannot read: `visited` is a plain boolean on the board, and an unreadable
 * one means "no evidence of a visit" rather than "unknown".
 */
function readBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
}

/**
 * `geoLocation:` is written as a two-element [latitude, longitude] list
 * (see the draft templates' own Example Layout blocks) -- entries may be
 * numbers or numeric strings depending on how they were pasted in, so both
 * are accepted and normalized to strings for display rather than parsed as
 * floats (nothing today needs to do map math with these, just show them).
 */
function readGeoLocation(value: unknown): [string, string] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  // Destructuring straight off `value` here would be an unsafe-any
  // assignment (Array.isArray narrows to `any[]`, not `unknown[]`) --
  // routing through an explicit `unknown[]` cast first keeps every value
  // below properly type-checked instead of silently `any`.
  const [lat, lng] = value as unknown[];
  if (
    (typeof lat !== 'string' && typeof lat !== 'number') ||
    (typeof lng !== 'string' && typeof lng !== 'number')
  )
    return null;
  return [String(lat), String(lng)];
}

function readTravelCountriesUnresolved(
  app: App,
  settings: APERtrailSettings
): Omit<TravelCountry, 'capital' | 'states'>[] {
  return travelNotesOfType(app, settings, settings.countriesFolder, 'country').map(
    ({ file, title, frontmatter: fm }) => ({
      file,
      title,
      capitalTitle: wikilinkTarget(findValue(fm, settings.capitalProperty)),
      stateTitles: wikilinkTargets(findValue(fm, settings.statesProperty)),
    })
  );
}

function readTravelStatesUnresolved(
  app: App,
  settings: APERtrailSettings
): Omit<TravelState, 'country' | 'capital' | 'cities'>[] {
  return travelNotesOfType(app, settings, settings.statesFolder, 'state').map(
    ({ file, title, frontmatter: fm }) => ({
      file,
      title,
      countryTitle: wikilinkTarget(findValue(fm, settings.countryProperty)),
      capitalTitle: wikilinkTarget(findValue(fm, settings.capitalProperty)),
      cityTitles: wikilinkTargets(findValue(fm, settings.citiesProperty)),
    })
  );
}

/**
 * Every booking note in the vault.
 *
 * Flat, and with no second pass: a booking names its trip by title and
 * every consumer matches on that, so there is no cross-reference to
 * resolve. Which also means bookings are readable on their own, without a
 * trip having been read first.
 */
function readTravelBookings(app: App, settings: APERtrailSettings): TravelBooking[] {
  return travelNotesInFolders(app, settings, bookingReadFolders(settings), 'booking')
    .map(({ file, title, frontmatter: fm }) => ({
      file,
      title,
      ...parseBooking(fm, bookingProperties(settings)),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** The settings a booking is read through, gathered once so the parser stays free of the whole settings object. */
export function bookingProperties(settings: APERtrailSettings): BookingPropertyNames {
  return {
    tripProperty: settings.bookingTripProperty,
    categoryProperty: settings.bookingCategoryProperty,
    statusProperty: settings.bookingStatusProperty,
    supplierProperty: settings.bookingSupplierProperty,
    placeProperty: settings.bookingPlaceProperty,
    dateProperty: settings.bookingDateProperty,
    amountProperty: settings.bookingAmountProperty,
    currencyProperty: settings.bookingCurrencyProperty,
    referenceProperty: settings.bookingReferenceProperty,
    payerProperty: settings.bookingPayerProperty,
    forProperty: settings.bookingForProperty,
    documentProperty: settings.bookingDocumentProperty,
  };
}

function readTravelCitiesUnresolved(
  app: App,
  settings: APERtrailSettings
): Omit<TravelCity, 'country' | 'state'>[] {
  return travelNotesOfType(app, settings, settings.citiesFolder, 'city').map(
    ({ file, title, frontmatter: fm }) => ({
      file,
      title,
      countryTitle: wikilinkTarget(findValue(fm, settings.countryProperty)),
      stateTitle: wikilinkTarget(findValue(fm, settings.stateProperty)),
      geoLocation: readGeoLocation(findValue(fm, settings.geoLocationProperty)),
      visited: readBool(findValue(fm, settings.visitedProperty)),
      lastVisit: readDateLike(findValue(fm, settings.lastVisitProperty)),
      // Both overwritten by applyDerivedVisits() once trips are read --
      // these are the note's own claim, before any trip evidence is folded in.
      visitedFromTrips: false,
      tags: readStringList(fm.tags),
    })
  );
}

function readTravelPlacesOfKindUnresolved(
  app: App,
  settings: APERtrailSettings,
  kind: TravelPlaceType
): Omit<TravelPlace, 'country' | 'city'>[] {
  const folder = settings[TRAVEL_PLACE_FOLDER_SETTING[kind]] as string;
  return travelNotesOfType(app, settings, folder, kind).map(({ file, title, frontmatter: fm }) => ({
    file,
    kind,
    title,
    countryTitle: wikilinkTarget(findValue(fm, settings.countryProperty)),
    cityTitle: wikilinkTarget(findValue(fm, settings.cityProperty)),
    geoLocation: readGeoLocation(findValue(fm, settings.geoLocationProperty)),
    visited: readBool(findValue(fm, settings.visitedProperty)),
    lastVisit: readDateLike(findValue(fm, settings.lastVisitProperty)),
    visitedFromTrips: false,
    tags: readStringList(fm.tags),
    address: readString(findValue(fm, settings.addressProperty)),
    website: readString(findValue(fm, settings.websiteProperty)),
    rating: readNumberLike(findValue(fm, settings.ratingProperty)),
    accommodationType: kind === 'accommodation' ? readString(fm.accommodationType) : null,
    accommodationStatus: kind === 'accommodation' ? readString(fm.accommodationStatus) : null,
    fnbType: kind === 'fnb' ? readString(fm.fnbType) : null,
    photoSpot:
      kind === 'photospot'
        ? parsePhotoSpotRecord({
            properties: photoSpotPropertyNames(settings),
            frontmatter: fm,
          })
        : null,
  }));
}

function readTravelPlacesUnresolved(
  app: App,
  settings: APERtrailSettings
): Omit<TravelPlace, 'country' | 'city'>[] {
  // TRAVEL_PLACE_TYPES rather than a literal list: the place family has
  // grown twice now, and a second copy of its membership here is a copy
  // that will be forgotten the third time.
  return TRAVEL_PLACE_TYPES.flatMap((kind) =>
    readTravelPlacesOfKindUnresolved(app, settings, kind)
  );
}

// photoSpotPropertyNames() is the photo spot equivalent, and lives in
// photo-spot-note.ts rather than here: it needs nothing but the settings
// interface, and keeping it beside the schema it fills means the pure
// parser can be unit-tested without mocking 'obsidian' at all. Re-exported
// so both mappings are reachable from the same place.
export { photoSpotPropertyNames };

/** Maps the flat APERtrailSettings fields onto the property-name bundle the pure Trip builder/parser both take -- one place that knows the mapping, so the two halves can never be handed different names. */
export function tripPropertyNames(settings: APERtrailSettings): TripPropertyNames {
  return {
    typePropertyName: settings.typePropertyName.trim() || 'type',
    subtitleProperty: settings.tripSubtitleProperty,
    imageProperty: settings.imageProperty,
    highlightsProperty: settings.tripHighlightsProperty,
    galleryProperty: settings.tripGalleryProperty,
    galleryImageField: settings.galleryImageField,
    galleryCaptionField: settings.galleryCaptionField,
    countryProperty: settings.countryProperty,
    citiesProperty: settings.tripCitiesProperty,
    departureProperty: settings.departureProperty,
    returnProperty: settings.returnProperty,
    travelTypeProperty: settings.travelTypeProperty,
    travelStatusProperty: settings.travelStatusProperty,
    reviewStatusProperty: settings.reviewStatusProperty,
    ratingProperty: settings.ratingProperty,
    createdProperty: settings.createdProperty,
    modifiedProperty: settings.modifiedProperty,
    personsProperty: settings.personsProperty,
    stopsProperty: settings.stopsProperty,
    daysProperty: settings.tripDaysProperty,
    dayNumberField: settings.dayNumberField,
    dayTitleField: settings.dayTitleField,
    dayNoteField: settings.dayNoteField,
    stopDayField: settings.stopDayField,
    stopPlaceField: settings.stopPlaceField,
    stopFromField: settings.stopFromField,
    stopToField: settings.stopToField,
    stopNoteField: settings.stopNoteField,
    stopMotifField: settings.stopMotifField,
    stopRatingField: settings.stopRatingField,
    stopCostField: settings.stopCostField,
    stopCurrencyField: settings.stopCurrencyField,
    stopCostUnitField: settings.stopCostUnitField,
    stopPersonsField: settings.stopPersonsField,
    nightsProperty: settings.nightsProperty,
    nightCheckInDayField: settings.nightCheckInDayField,
    nightCheckOutDayField: settings.nightCheckOutDayField,
    nightAccommodationField: settings.nightAccommodationField,
    nightCheckInField: settings.nightCheckInField,
    nightCheckOutField: settings.nightCheckOutField,
    nightCostField: settings.nightCostField,
    nightCurrencyField: settings.nightCurrencyField,
    nightCostUnitField: settings.nightCostUnitField,
    nightPersonsField: settings.nightPersonsField,
    transportProperty: settings.transportProperty,
    legDirectionField: settings.legDirectionField,
    legDayField: settings.legDayField,
    legToDayField: settings.legToDayField,
    legCarrierField: settings.legCarrierField,
    legModeField: settings.legModeField,
    legFromField: settings.legFromField,
    legToField: settings.legToField,
    legReferenceField: settings.legReferenceField,
    legOriginField: settings.legOriginField,
    legDestinationField: settings.legDestinationField,
    legCostField: settings.legCostField,
    legCurrencyField: settings.legCurrencyField,
    legCostUnitField: settings.legCostUnitField,
    legPersonsField: settings.legPersonsField,
    tripCurrencyProperty: settings.tripCurrencyProperty,
    budgetProperty: settings.budgetProperty,
    budgetCategoryField: settings.budgetCategoryField,
    budgetAmountField: settings.budgetAmountField,
    ratesProperty: settings.ratesProperty,
    rateCurrencyField: settings.rateCurrencyField,
    rateValueField: settings.rateValueField,
  };
}

/** A Trip with its own frontmatter read, but before its Country/City/place references have been looked up -- see readTravelBoard()'s two-pass note. */
interface UnresolvedTrip {
  file: TFile;
  title: string;
  record: ParsedTripRecord;
  effectiveStatus: TravelTrip['effectiveStatus'];
}

/**
 * Unlike every other entity type above, Trip frontmatter is parsed by the
 * pure parseTripRecord() rather than inline here. The Trip schema is large
 * enough (participants, the cities a trip touches, a timed itinerary,
 * accommodation nights, transport legs) that its build and parse halves
 * need round-trip testing against each other without an App in the way.
 * See docs/design/trip-model-redesign.md.
 */
function readTravelTripsUnresolved(
  app: App,
  settings: APERtrailSettings,
  today: string
): UnresolvedTrip[] {
  const properties = tripPropertyNames(settings);
  return travelNotesOfType(app, settings, settings.tripsFolder, 'trip').map(
    ({ file, title, frontmatter }) => {
      const record = parseTripRecord({ properties, frontmatter });
      return { file, title, record, effectiveStatus: effectiveTravelStatus(record, today) };
    }
  );
}

/**
 * Resolves one stop's `place` wikilink against Cities and all four place
 * types at once.
 *
 * City wins a title tie. Cities are the coarser, more frequently
 * referenced level, and a vault that has both a City and a Location named
 * "Basel" almost certainly means the City when it writes "[[Basel]]" in an
 * itinerary. This is a documented tie-break, not an accident of lookup
 * order -- see docs/design/trip-model-redesign.md §2.4.
 */
function resolveStop(
  stop: ParsedTripRecord['stops'][number],
  cityByTitle: Map<string, TravelCity>,
  placeByTitle: Map<string, TravelPlace>
): TravelTripStop {
  const city = stop.placeTitle ? cityByTitle.get(stop.placeTitle) : undefined;
  const place = stop.placeTitle ? placeByTitle.get(stop.placeTitle) : undefined;
  const target = city ?? place ?? null;
  const targetKind: TravelStopTargetKind | null = city ? 'city' : (place?.kind ?? null);
  return { ...stop, target, targetKind };
}

function resolveNight(
  night: ParsedTripRecord['nights'][number],
  placeByTitle: Map<string, TravelPlace>
): TravelTripNight {
  const place = night.accommodationTitle ? placeByTitle.get(night.accommodationTitle) : undefined;
  return { ...night, accommodation: place ?? null };
}

/**
 * `today` is a parameter rather than read from the clock inside, so the
 * date-derived Travel Status fallback (see trip-note.ts's
 * effectiveTravelStatus()) is deterministic under test. Callers in the UI
 * omit it and get the real today.
 */
export function readTravelBoard(
  app: App,
  settings: APERtrailSettings,
  today: string = formatDayTitle(new Date())
): TravelBoard {
  // Countries, States, and Cities form a real cycle (Country <-> State <->
  // City, plus each level's own Capital reference pointing back down), so
  // no single pass order resolves every reference the first time through.
  // Build skeleton objects for all three levels first (cross-reference
  // fields left as null/[]), index them by title, then mutate in the
  // resolved cross-references in a second pass now that every skeleton
  // instance already exists to point at.
  const countries: TravelCountry[] = readTravelCountriesUnresolved(app, settings).map((c) => ({
    ...c,
    capital: null,
    states: [],
  }));
  const states: TravelState[] = readTravelStatesUnresolved(app, settings).map((s) => ({
    ...s,
    country: null,
    capital: null,
    cities: [],
  }));
  const cities: TravelCity[] = readTravelCitiesUnresolved(app, settings).map((c) => ({
    ...c,
    country: null,
    state: null,
  }));

  const countryByTitle = new Map(countries.map((c) => [c.title, c]));
  const stateByTitle = new Map(states.map((s) => [s.title, s]));
  const cityByTitle = new Map(cities.map((c) => [c.title, c]));

  for (const country of countries) {
    country.capital = country.capitalTitle ? (cityByTitle.get(country.capitalTitle) ?? null) : null;
    country.states = country.stateTitles
      .map((title) => stateByTitle.get(title))
      .filter((s): s is TravelState => s !== undefined);
  }
  for (const state of states) {
    state.country = state.countryTitle ? (countryByTitle.get(state.countryTitle) ?? null) : null;
    state.capital = state.capitalTitle ? (cityByTitle.get(state.capitalTitle) ?? null) : null;
    state.cities = state.cityTitles
      .map((title) => cityByTitle.get(title))
      .filter((c): c is TravelCity => c !== undefined);
  }
  for (const city of cities) {
    city.country = city.countryTitle ? (countryByTitle.get(city.countryTitle) ?? null) : null;
    city.state = city.stateTitle ? (stateByTitle.get(city.stateTitle) ?? null) : null;
  }

  // Places and Trips only ever reference Country/City (never each other,
  // never State directly), so they resolve in a single pass against the
  // maps built above.
  const places: TravelPlace[] = readTravelPlacesUnresolved(app, settings).map((p) => ({
    ...p,
    country: p.countryTitle ? (countryByTitle.get(p.countryTitle) ?? null) : null,
    city: p.cityTitle ? (cityByTitle.get(p.cityTitle) ?? null) : null,
  }));

  // Trips resolve last: their itinerary stops point at Cities and places,
  // so both of those have to be fully built and indexed first. Still one
  // pass, since nothing points back UP at a Trip.
  const placeByTitle = new Map(places.map((p) => [p.title, p]));
  const trips: TravelTrip[] = readTravelTripsUnresolved(app, settings, today).map((t) => ({
    file: t.file,
    title: t.title,
    subtitle: t.record.subtitle,
    image: t.record.image,
    highlights: t.record.highlights,
    gallery: t.record.gallery,
    countryTitle: t.record.countryTitle,
    country: t.record.countryTitle ? (countryByTitle.get(t.record.countryTitle) ?? null) : null,
    cityTitles: t.record.cityTitles,
    cities: t.record.cityTitles
      .map((title) => cityByTitle.get(title))
      .filter((c): c is TravelCity => c !== undefined),
    departure: t.record.departure,
    return: t.record.return,
    currency: t.record.currency,
    budget: t.record.budget,
    rates: t.record.rates,
    travelType: t.record.travelType,
    travelStatus: t.record.travelStatus,
    effectiveStatus: t.effectiveStatus,
    reviewStatus: t.record.reviewStatus,
    rating: t.record.rating,
    personTitles: t.record.personTitles,
    days: t.record.days,
    stops: t.record.stops.map((stop) => resolveStop(stop, cityByTitle, placeByTitle)),
    nights: t.record.nights.map((night) => resolveNight(night, placeByTitle)),
    transport: t.record.transport,
  }));

  // Trips are read last, so this is the first point at which a place's
  // visit evidence exists. Folded into the already-built City/place
  // objects in place (see visit-derivation.ts) -- every cross-reference
  // above already points at these exact instances, so replacing them
  // would leave the board pointing at stale copies.
  applyDerivedVisits(cities, places, trips);

  return {
    trips: trips.sort((a, b) => a.title.localeCompare(b.title)),
    bookings: readTravelBookings(app, settings),
    countries: countries.sort((a, b) => a.title.localeCompare(b.title)),
    states: states.sort((a, b) => a.title.localeCompare(b.title)),
    cities: cities.sort((a, b) => a.title.localeCompare(b.title)),
    places: places.sort((a, b) => a.title.localeCompare(b.title)),
  };
}
