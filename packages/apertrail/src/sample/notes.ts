/**
 * The sample notes APERtrail offers to write into an empty vault: sixteen
 * notes covering every entity type this plugin reads, in English, with every
 * folder and every property name resolved through settings.
 *
 * Pure. No `App`, no `t()`, no DOM: hand it a settings object and a clock and
 * it answers the same way every time, which is what lets a test read the whole
 * set back through the real parsers without a vault in the way.
 *
 * Two things it reaches for rather than restates, and both are deliberate:
 * `tripPropertyNames()` (the one mapping from these settings onto the Trip
 * schema's property names) and `TRAVEL_ITINERARY_BLOCK_LANG`. Copying either
 * here would be a second spelling of something the plugin already spells once,
 * and a sample vault whose notes were built by a parallel implementation would
 * stop demonstrating the real one the first time the two drifted.
 *
 * ## Two rules the content follows
 *
 * **Every datetime is a string, never a `Date`.** Obsidian's YAML parser turns
 * an unquoted `2026-02-13T09:00` into a native Date and the time is lost on the
 * way back in, so anything carrying a clock time is written as a quoted string.
 * Every one of them here goes out through `buildTripFrontmatter()`, which is
 * the plugin's own writer and the place that decision already lives. See
 * `trips/trip-note.ts`'s header and docs/design/data-model.md's "datetime sharp
 * edge".
 *
 * **Nothing derived is written back**, with exactly one deliberate exception,
 * marked where it happens: `visited` and `lastVisit` are derived from the trips
 * that stop at a place (vault/visit-derivation.ts), so seeding them would
 * create a second source of truth that quietly disagrees with the first.
 *
 * ## Where a trip note goes
 *
 * Into a folder of its own, named after the trip, because that is where
 * `newTripFolder()` puts every trip this plugin creates. One consequence worth
 * naming: the trips folder itself is therefore not a target folder, so the
 * planner's refusal rule is judged per trip folder rather than over `Trips/` as
 * a whole. A vault that already has trips filed flat in `Trips/` is not refused
 * on their account; a folder named after one of these sample trips that holds
 * somebody else's note is.
 */
import { summaryBody, type SampleNote } from '@technosoftware/trail-core';
import { APERtrailSettings } from '../settings/types';
import { TravelEntityType } from '../vault/entity-types';
import { buildTripFrontmatter } from '../trips/trip-note';
import { buildPhotoSpotFrontmatter, photoSpotPropertyNames } from '../places/photo-spot-note';
import { tripPropertyNames } from '../vault/read-entities';
import { TRAVEL_ITINERARY_BLOCK_LANG } from '../trips/write-trip';
import type { TripInput } from '../trips/write-trip';
import type { PhotoSpotInput } from '../places/write-photo-spot';
import { APT_TRIP_COSTS_BLOCK_LANG } from '../trips/costs/trip-costs-block-lang';
import { APT_PHOTO_SPOT_BLOCK_LANG } from '../places/photo-spot-block-lang';
import { TRAVEL_RELATED_TRIPS_BLOCK_LANG } from '../trips/related-trips-block-lang';
import { newTripFolder } from '../trips/trip-folder';

const tripType: TravelEntityType = 'trip';

/** A fenced block with nothing in it, which is how every block this plugin seeds starts life. */
function fence(language: string): string {
  return `\`\`\`${language}\n\`\`\`\n`;
}

/**
 * The body a City or place note carries: the related-trips block, so the note
 * answers "when was I here" from the moment it exists. Same body
 * `createCityNote()` and `createPlaceNote()` write.
 */
function relatedTripsBody(prose = ''): string {
  return prose
    ? `\n${prose}\n\n${fence(TRAVEL_RELATED_TRIPS_BLOCK_LANG)}`
    : `\n${fence(TRAVEL_RELATED_TRIPS_BLOCK_LANG)}`;
}

/** A wikilink, spelled the one way every reference in these notes is spelled. */
function link(title: string): string {
  return `[[${title}]]`;
}

/**
 * A trip's frontmatter, minus the two keys the writer places itself.
 *
 * Through the plugin's own builder rather than assembled by hand: it decides
 * which sub-keys are omitted, how a cost unit is written beside a figure, and
 * that every datetime leaves as a string. A sample note assembled around those
 * rules instead of through them would look right and drift.
 */
function tripProperties(settings: APERtrailSettings, input: TripInput): Record<string, unknown> {
  const properties = tripPropertyNames(settings);
  const yaml = buildTripFrontmatter({
    properties,
    typeValue: tripType,
    ...input,
    // Both stamps belong to the writer: `created` is stamped there so it sits
    // directly after the type, and a note being created has never been edited.
    created: null,
    modified: null,
  });
  delete yaml[properties.typePropertyName];
  return yaml;
}

/** A photo spot's photography keys, built by the same schema the block edits. */
function photoSpotProperties(
  settings: APERtrailSettings,
  input: PhotoSpotInput
): Record<string, unknown> {
  return buildPhotoSpotFrontmatter({
    properties: photoSpotPropertyNames(settings),
    ...input,
    modified: null,
  });
}

export function sampleNotes(settings: APERtrailSettings, now: Date): SampleNote[] {
  // `now` is unused by the content itself and that is the point: a named trip
  // has real dates, and a sample vault whose trips slid forward every time
  // somebody ran the command would demonstrate a different trip each week. It
  // is in the signature because these three plugins ship one command between
  // them and their content functions have to be interchangeable, and because
  // anything genuinely relative belongs here rather than in the writer.
  void now;

  return [
    ...countries(settings),
    ...states(settings),
    ...cities(settings),
    ...places(settings),
    ...vehicles(settings),
    ...trips(settings),
    ...crm(settings),
  ];
}

/**
 * The top of the hierarchy.
 *
 * Switzerland carries `states:` and no `capital:`; South Africa carries
 * `capital:` and no `states:`. Between them they show both halves of the shape
 * and neither one lies: Bern is not in this vault, so Switzerland names no
 * capital rather than naming a city it has, and South Africa uses no state
 * level here, which is why `state:` is optional on a City.
 */
function countries(settings: APERtrailSettings): SampleNote[] {
  return [
    {
      folder: settings.countriesFolder,
      title: 'Switzerland',
      typeValue: 'country',
      properties: { [settings.statesProperty]: [link('Aargau')] },
      body: '',
    },
    {
      folder: settings.countriesFolder,
      title: 'South Africa',
      typeValue: 'country',
      properties: { [settings.capitalProperty]: link('Pretoria') },
      body: '',
    },
  ];
}

/** The middle level, pointing up at its country and down at its cities. No `capital:`, because Aarau is not a note here. */
function states(settings: APERtrailSettings): SampleNote[] {
  return [
    {
      folder: settings.statesFolder,
      title: 'Aargau',
      typeValue: 'state',
      properties: {
        [settings.countryProperty]: link('Switzerland'),
        [settings.citiesProperty]: [link('Brugg')],
      },
      body: '',
    },
  ];
}

function cities(settings: APERtrailSettings): SampleNote[] {
  return [
    {
      folder: settings.citiesFolder,
      title: 'Brugg',
      typeValue: 'city',
      properties: {
        [settings.countryProperty]: link('Switzerland'),
        [settings.stateProperty]: link('Aargau'),
        [settings.geoLocationProperty]: ['47.4817', '8.2081'],
        // A cover image that resolves to nothing, on purpose. The vault
        // convention is a `_resources` folder beside the notes that embed it,
        // and the seeder writes notes and no pictures, so this is the state a
        // card has to render gracefully: a path, and no file behind it.
        [settings.imageProperty]: 'Places/Cities/_resources/Brugg.png',
        // ── The one note in this set that says its own visited state. ──
        // Everywhere else `visited` and `lastVisit` are left out, because a
        // place's visited state is derived from the trips that stop there and
        // writing it as well would be two sources of truth that disagree.
        // Brugg is the exception that shows the rule has an escape: the Aargau
        // Weekend trip records no stops, so nothing derives a visit here, and
        // a town somebody knew long before this vault existed still has a
        // history worth keeping. An explicit value wins over the derived one,
        // and an explicit `lastVisit` is folded in alongside derived dates
        // rather than replaced. See vault/visit-derivation.ts.
        [settings.visitedProperty]: true,
        [settings.lastVisitProperty]: '2019-06-08',
      },
      body: relatedTripsBody(
        'A small town at the point where the Aare, the Reuss and the Limmat come together, ' +
          'with a black tower on the old bridge and a station four minutes from the water.'
      ),
      ensureBlock: TRAVEL_RELATED_TRIPS_BLOCK_LANG,
    },
    {
      folder: settings.citiesFolder,
      title: 'Cape Town',
      typeValue: 'city',
      properties: {
        [settings.countryProperty]: link('South Africa'),
        [settings.geoLocationProperty]: ['-33.9249', '18.4241'],
        [settings.imageProperty]: 'Places/Cities/_resources/Cape Town.png',
      },
      body: relatedTripsBody(
        'The end of the line for the train from Pretoria, under a flat mountain that makes ' +
          'its own weather. No state note stands between this city and its country, which is ' +
          'the ordinary case outside the countries that use that level.'
      ),
      ensureBlock: TRAVEL_RELATED_TRIPS_BLOCK_LANG,
    },
    {
      // The other extreme, and it has to be as comfortable as the two above: a
      // note carrying its type, its place in the hierarchy and nothing else.
      folder: settings.citiesFolder,
      title: 'Pretoria',
      typeValue: 'city',
      properties: { [settings.countryProperty]: link('South Africa') },
      body: relatedTripsBody(),
      ensureBlock: TRAVEL_RELATED_TRIPS_BLOCK_LANG,
    },
  ];
}

/**
 * The four plain place types and the photo spot.
 *
 * `accommodationType`, `accommodationStatus` and `fnbType` are read at fixed
 * names rather than through settings, and are the three documented exceptions
 * to this plugin's "every property name is a setting" rule: each belongs to one
 * subtype rather than to the shared place shape. See
 * docs/design/data-model.md.
 */
function places(settings: APERtrailSettings): SampleNote[] {
  return [
    {
      folder: settings.accommodationFolder,
      title: 'Table Bay Lodge',
      typeValue: 'accommodation',
      properties: {
        [settings.countryProperty]: link('South Africa'),
        [settings.cityProperty]: link('Cape Town'),
        [settings.geoLocationProperty]: ['-33.9027', '18.4201'],
        accommodationType: 'Hotel',
        accommodationStatus: 'Booked',
      },
      body: relatedTripsBody(),
      ensureBlock: TRAVEL_RELATED_TRIPS_BLOCK_LANG,
    },
    {
      folder: settings.fnbFolder,
      title: 'Cafe Fahrwerk',
      typeValue: 'fnb',
      properties: {
        [settings.countryProperty]: link('Switzerland'),
        [settings.cityProperty]: link('Brugg'),
        fnbType: 'Cafe',
        [settings.addressProperty]: 'Bahnhofstrasse 12, 5200 Brugg',
        [settings.websiteProperty]: 'https://cafe-fahrwerk.example',
        [settings.ratingProperty]: 4,
      },
      body: relatedTripsBody(
        'Two minutes from the station, on the way into the old town. Opens early enough ' +
          'to be useful before a train.'
      ),
      ensureBlock: TRAVEL_RELATED_TRIPS_BLOCK_LANG,
    },
    {
      folder: settings.landmarksFolder,
      title: 'Table Mountain',
      typeValue: 'landmark',
      properties: {
        [settings.countryProperty]: link('South Africa'),
        [settings.cityProperty]: link('Cape Town'),
        [settings.geoLocationProperty]: ['-33.9628', '18.4098'],
        [settings.ratingProperty]: 5,
      },
      body: relatedTripsBody(
        'The cable car runs from Tafelberg Road when the wind allows it, which is not ' +
          'every day it is scheduled to.'
      ),
      ensureBlock: TRAVEL_RELATED_TRIPS_BLOCK_LANG,
    },
    {
      // The catch-all, for somewhere worth remembering that is neither a bed,
      // a meal, a landmark nor a picture.
      folder: settings.locationsFolder,
      title: 'Aare Riverside Path',
      typeValue: 'location',
      properties: {
        [settings.countryProperty]: link('Switzerland'),
        [settings.cityProperty]: link('Brugg'),
      },
      body: relatedTripsBody(
        'The towpath downstream from the old bridge. Forty minutes there and back, flat ' +
          'the whole way, and the only shade in Brugg on a hot afternoon.'
      ),
      ensureBlock: TRAVEL_RELATED_TRIPS_BLOCK_LANG,
    },
    signalHill(settings),
  ];
}

/**
 * The full photo spot shape: access details, a transit entry, and two motifs
 * that each carry their own coordinates, bearing, light window, season, lens
 * and gear, one of them captured and one still owed.
 *
 * This is the note that lights the photo spot block and the sun work, so its
 * coordinates are the real ones and its two motifs point in genuinely
 * different directions: the sun band only says something useful when a bearing
 * and a light window disagree with each other somewhere.
 */
function signalHill(settings: APERtrailSettings): SampleNote {
  const photography = photoSpotProperties(settings, {
    timezone: 'Africa/Johannesburg',
    openingHours: '24h',
    entryFee: 'none',
    accessibility: 'partial',
    parking: 'Signal Hill Road summit car park, free, fills up before sunset',
    transit: [
      {
        mode: 'car',
        detail: 'Signal Hill Road from Kloof Nek, about ten minutes up from the city bowl',
      },
    ],
    motifs: [
      {
        name: 'City bowl from the saddle',
        role: 'main',
        geoLocation: ['-33.9155', '18.4023'],
        // Shooting east, into the city and away from the sun, which is what
        // makes this an evening motif rather than a morning one.
        direction: 100,
        light: ['golden-hour-evening', 'blue-hour-evening'],
        season: [11, 12, 1, 2],
        lens: '24-70',
        gear: ['tripod'],
        technique: null,
        note: 'Park at the summit and walk back down the road about two hundred metres, to where the wall drops away on the left.',
        captured: true,
        capturedOn: '2026-02-13',
      },
      {
        name: 'Noon Gun terrace',
        role: 'secondary',
        geoLocation: ['-33.9214', '18.4083'],
        // West-south-west, out over the Atlantic side, so this one wants the
        // rising sun behind the camera and is a morning motif for the same
        // reason the one above is an evening one.
        direction: 250,
        light: ['blue-hour-morning', 'sunrise'],
        season: [3, 4, 5, 9, 10],
        lens: '70-200',
        gear: ['tripod', 'polarizer'],
        technique:
          'Long lens, and stand well back: the terrace wall reads as a foreground line rather than as an edge.',
        note: 'Up Military Road above Bo-Kaap. The gun fires at noon and the terrace is busy for twenty minutes either side of it.',
        captured: false,
        capturedOn: null,
      },
    ],
    samples: [],
  });

  return {
    folder: settings.photoSpotsFolder,
    title: 'Signal Hill',
    typeValue: 'photospot',
    properties: {
      [settings.countryProperty]: link('South Africa'),
      [settings.cityProperty]: link('Cape Town'),
      [settings.geoLocationProperty]: ['-33.9167', '18.4000'],
      [settings.ratingProperty]: 5,
      ...photography,
    },
    body:
      "\nThe ridge between Lion's Head and the sea, reached by a road that ends in a car park.\n" +
      'Two motifs on one hill, twenty minutes apart on foot and twelve hours apart in the light\n' +
      'they want.\n\n' +
      '> [!info] Did you know?\n' +
      '> A gun has been fired over this city at noon since 1806, and from this hill since 1902.\n' +
      '> It is still set off by an observatory signal rather than by the person standing beside it.\n\n' +
      fence(APT_PHOTO_SPOT_BLOCK_LANG) +
      '\n' +
      fence(TRAVEL_RELATED_TRIPS_BLOCK_LANG),
    ensureBlock: TRAVEL_RELATED_TRIPS_BLOCK_LANG,
  };
}

/**
 * The body a Trip note starts with: the itinerary block and the costs block,
 * which is what `createTripNote()` seeds. The Rovos trip opens with a summary
 * callout above them, the block trail-core owns and both this plugin and
 * NODAtrail's PARA notes write.
 */
function tripBody(overview: string): string {
  const blocks = `\n${fence(TRAVEL_ITINERARY_BLOCK_LANG)}\n${fence(APT_TRIP_COSTS_BLOCK_LANG)}`;
  const summary = summaryBody(overview);
  return summary ? `\n${summary}\n${blocks}` : blocks;
}

/**
 * Two trips, chosen to cover the range rather than to be two of a kind.
 *
 * Rovos Rail 2026 is finished and reviewed and carries everything a trip can
 * carry: named days, stops with times, a rating on one of them, nights, a leg
 * in each direction, participants, its own currency, a budget and a rate.
 * Aargau Weekend carries almost nothing, and not even a `travelStatus:`, so it
 * is the trip that exercises the derived status every reader falls back to.
 */
function trips(settings: APERtrailSettings): SampleNote[] {
  const rovos: TripInput = {
    subtitle: 'Pretoria to Cape Town aboard the Pride of Africa',
    image: null,
    highlights: [
      'Three nights on the train, through the Karoo and over the Hex River pass',
      'Two nights in Cape Town at the end of it',
    ],
    gallery: [],
    countryTitle: 'South Africa',
    cityTitles: ['Pretoria', 'Cape Town'],
    // Quoted on the way out, like every datetime this plugin writes: an
    // unquoted one comes back as a Date with its time discarded.
    departure: '2026-02-09T09:00',
    return: '2026-02-14T18:30',
    travelType: 'Rail journey',
    travelStatus: 'Over',
    reviewStatus: 'Reviewed',
    rating: 5,
    personTitles: ['Stefan', 'Erika'],
    days: [
      {
        day: 1,
        title: 'Boarding at Rovos Rail Station',
        note: 'Departure is from the private station in Pretoria rather than from the main one.',
      },
      // Day 4 is the day the train pulls in, counted from the departure: see
      // relative-days.ts for why a day number rather than a date.
      { day: 4, title: 'Cape Town', note: null },
    ],
    stops: [
      {
        placeTitle: 'Pretoria',
        day: null,
        from: '2026-02-09T09:00',
        to: null,
        note: 'Boarding, and lunch once the train is moving.',
        rating: null,
        motifName: null,
        cost: null,
        currency: null,
        costUnit: 'total',
        persons: [],
        variants: [],
        optional: false,
        chosen: false,
      },
      {
        placeTitle: 'Table Mountain',
        day: null,
        from: '2026-02-13T13:00',
        to: '2026-02-13T16:00',
        note: 'Cable car up, walked down the Platteklip gorge.',
        rating: 5,
        motifName: null,
        cost: 420,
        currency: 'ZAR',
        costUnit: 'person',
        persons: [],
        variants: [],
        optional: false,
        chosen: false,
      },
      {
        placeTitle: 'Signal Hill',
        day: null,
        from: '2026-02-13T18:00',
        to: '2026-02-13T19:45',
        note: null,
        rating: null,
        // Names the motif rather than its position in the list, because
        // motifs get reordered and an index would come to mean another
        // picture. It has to match the motif's own `name`.
        motifName: 'City bowl from the saddle',
        cost: null,
        currency: null,
        costUnit: 'total',
        persons: [],
        variants: [],
        optional: false,
        chosen: false,
      },
    ],
    nights: [
      {
        accommodationTitle: 'Table Bay Lodge',
        checkInDay: null,
        checkOutDay: null,
        checkIn: '2026-02-12',
        checkOut: '2026-02-14',
        cost: 3600,
        currency: 'ZAR',
        // A room per night, multiplied by the nights of the stay rather than
        // by the people in it. The leg below is the other case.
        costUnit: 'night',
        persons: [],
        variants: [],
        optional: false,
        chosen: false,
      },
    ],
    transport: [
      {
        direction: 'outbound',
        mode: 'train',
        // A wikilink, because this carrier does have a note here. Read down to
        // its title either way, which is what lets an airline that will never
        // be a note stand as plain text in the same field.
        carrier: link('Rovos Rail Charters'),
        // The company runs it; the train is the thing you are on. The sample
        // carries both because the pair is the whole reason the field exists.
        vehicleTitle: 'Rovos Rail Pride of Africa',
        day: null,
        toDay: null,
        from: '2026-02-09T09:00',
        to: '2026-02-12T11:30',
        reference: 'RR-2609',
        origin: 'Pretoria',
        destination: 'Cape Town',
        cost: 52000,
        currency: 'ZAR',
        costUnit: 'person',
        persons: [],
        // One price, which is what a line usually has. The variants a line
        // can carry, and the optional flag beside them, are demonstrated in
        // the tests rather than here: the sample vault is a fixture other
        // suites assert figures against, and a second price on it would be a
        // second figure to keep in step.
        variants: [],
        optional: false,
        chosen: false,
      },
      {
        direction: 'inbound',
        mode: 'plane',
        carrier: 'Swiss',
        // A flight is not a vehicle note. Nobody keeps a note per airframe,
        // which is why this is a link somebody may make rather than a field
        // every leg fills in.
        vehicleTitle: null,
        day: null,
        toDay: null,
        from: '2026-02-14T18:30',
        to: '2026-02-15T05:25',
        reference: 'LX289',
        origin: 'Cape Town',
        destination: 'Zurich',
        cost: 910,
        currency: 'CHF',
        costUnit: 'person',
        persons: [],
        // One price, which is what a line usually has. The variants a line
        // can carry, and the optional flag beside them, are demonstrated in
        // the tests rather than here: the sample vault is a fixture other
        // suites assert figures against, and a second price on it would be a
        // second figure to keep in step.
        variants: [],
        optional: false,
        chosen: false,
      },
    ],
    currency: 'CHF',
    budget: [
      { category: 'transport', amount: 7000 },
      { category: 'accommodation', amount: 400 },
      { category: 'activity', amount: 200 },
      { category: 'food', amount: 500 },
    ],
    // What the trip converts its ZAR figures at, as typed, never fetched. The
    // trip plans in CHF, so this is the one rate it needs.
    rates: [{ currency: 'ZAR', rate: 0.048 }],
  };

  const weekend: TripInput = {
    subtitle: null,
    image: null,
    highlights: [],
    gallery: [],
    countryTitle: 'Switzerland',
    cityTitles: ['Brugg'],
    departure: '2026-10-17T09:12',
    return: '2026-10-18T17:40',
    travelType: null,
    // Deliberately absent, and the point of this note: a trip whose author
    // never typed a status still has to appear everywhere a trip appears, on
    // the status derived from its own dates.
    travelStatus: null,
    reviewStatus: null,
    rating: null,
    personTitles: ['Stefan'],
    days: [],
    stops: [],
    nights: [],
    transport: [],
    currency: null,
    budget: [],
    rates: [],
  };

  return [
    {
      folder: newTripFolder(settings, 'Rovos Rail 2026'),
      title: 'Rovos Rail 2026',
      typeValue: tripType,
      properties: tripProperties(settings, rovos),
      body: tripBody(
        'Five days from Pretoria to Cape Town on the Pride of Africa, three of them on the ' +
          'train and two at the far end of it. Booked a year ahead, and worth every week of ' +
          'the wait.'
      ),
    },
    {
      folder: newTripFolder(settings, 'Aargau Weekend'),
      title: 'Aargau Weekend',
      typeValue: tripType,
      properties: tripProperties(settings, weekend),
      body: tripBody(''),
    },
  ];
}

/**
 * The two people and the one company.
 *
 * These are the notes APERtrail reads rather than owns: CULItrail matches the
 * same folders on the same `type:` values, so a vault seeded by both ends up
 * with one Stefan answering to both plugins. That is why they carry
 * `ensureBlock`: whichever plugin runs second finds the note already there,
 * skips it, and appends only the fence it owns the constant for.
 *
 * **These three are the only notes here marked `shared`, and the company is why
 * the flag exists.** The refusal rule -- a target folder may hold nothing but
 * notes this plan would itself write -- was written with `CRM/People` in mind,
 * where all three plugins seed the same two people and nobody is a stranger to
 * anybody. `CRM/Companies` is not that case and it broke the first time the
 * three seeders were run against one vault: each plugin seeds the company its
 * own notes need, a rail operator here and a meal supplier next door, and no
 * contract says which companies a vault holds. The second plugin to run found
 * the first one's company sitting there, called it a stranger and refused
 * everything. Marking a folder shared makes the planner report what is already
 * in it rather than refuse over it. `CRM/People` is marked too, for the same
 * reason rather than for a need it has yet: a vault whose contacts folder holds
 * one more person than these two is not a vault this plugin should decline to
 * help.
 */
/**
 * The thing you travel on, as against the places you travel to.
 *
 * One note, and it is the train the sample's own trip is taken on, so the
 * `vehicle:` on that leg resolves to something a reader can open. It carries
 * the two halves that are easy to get wrong: an `operator:` pointing at the
 * Company note beside it -- a fact about the train, and still no link from a
 * trip to a company -- and a cabin catalogue with no prices in it, because
 * what a suite costs belongs to the sailing that books it and lives on the
 * leg's variants.
 */
function vehicles(settings: APERtrailSettings): SampleNote[] {
  return [
    {
      folder: settings.vehiclesFolder,
      title: 'Rovos Rail Pride of Africa',
      typeValue: 'vehicle',
      properties: {
        [settings.vehicleModeProperty]: 'train',
        [settings.vehicleOperatorProperty]: link('Rovos Rail Charters'),
        [settings.vehicleBuiltProperty]: '1989',
        [settings.vehicleRefurbishedProperty]: '2019',
        [settings.vehicleCapacityProperty]: 72,
        [settings.vehicleLengthProperty]: '20 coaches',
        [settings.websiteProperty]: 'https://rovos-charters.example/pride-of-africa',
        [settings.vehicleCabinsProperty]: [
          {
            [settings.cabinNameField]: 'Pullman Suite',
            [settings.cabinDescriptionField]:
              'Two berths, a shower room, and a window seat that converts. About 7 m2.',
          },
          {
            [settings.cabinNameField]: 'Deluxe Suite',
            [settings.cabinDescriptionField]:
              'Twin or double, a private bathroom with a shower, and a small lounge area. About 10 m2.',
          },
          {
            [settings.cabinNameField]: 'Royal Suite',
            [settings.cabinDescriptionField]:
              'Half a carriage: a lounge, a bathroom with a Victorian bath, and both windows. About 16 m2.',
          },
        ],
      },
      body: relatedTripsBody(),
      ensureBlock: TRAVEL_RELATED_TRIPS_BLOCK_LANG,
    },
  ];
}

function crm(settings: APERtrailSettings): SampleNote[] {
  const person = (title: string, email: string): SampleNote => ({
    folder: settings.personsFolder,
    title,
    typeValue: settings.personTypeValue,
    properties: {
      [settings.personTagProperty]: ['Family'],
      [settings.personRolesProperty]: ['traveller', 'eater'],
      [settings.emailProperty]: email,
    },
    // No `# Stefan` heading: the filename is the title, and the body is this
    // plugin's own related-trips block and nothing else.
    body: relatedTripsBody(),
    ensureBlock: TRAVEL_RELATED_TRIPS_BLOCK_LANG,
    shared: true,
  });

  return [
    person('Stefan', 'stefan@example.invalid'),
    person('Erika', 'erika@example.invalid'),
    {
      folder: settings.companiesFolder,
      title: 'Rovos Rail Charters',
      typeValue: settings.companyTypeValue,
      properties: {
        [settings.companyTagProperty]: ['Travel'],
        [settings.companyRolesProperty]: ['carrier'],
        [settings.websiteProperty]: 'https://rovos-charters.example',
        [settings.phoneProperty]: '+27 12 555 0142',
      },
      // No block. Nothing links a trip to a company, so a related-trips block
      // here could only ever say "no trips yet", which is worse than no block.
      body: '',
      shared: true,
    },
  ];
}
