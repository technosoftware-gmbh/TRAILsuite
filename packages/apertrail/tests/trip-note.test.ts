/**
 * Round-trip and edge-case coverage for the Trip frontmatter schema --
 * see docs/design/trip-model-redesign.md. Pure, so this needs neither the
 * fake vault nor the 'obsidian' mock: buildTripFrontmatter() is asserted
 * against parseTripRecord() directly, which is the point of keeping both
 * halves in one App-free module.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { tripPropertyNames } from '../src/vault/read-entities';
import { aLegInput, aNightInput, aStopInput } from './fixtures';
import {
  buildTripFrontmatter,
  effectiveTravelStatus,
  parseTripRecord,
  TripFrontmatterInput,
  TripPropertyNames,
  tripManagedKeys,
} from '../src/trips/trip-note';

/**
 * The property names a vault gets out of the box.
 *
 * Derived from the real mapping rather than written out again. A hand-kept
 * literal is what let five day-number settings and `stopMotifField` sit as
 * `undefined` through this whole suite: it type-checks as `TripPropertyNames`
 * and, with `tests/` outside the typecheck, nothing said the fields were
 * missing -- so every test that should have covered them covered nothing.
 *
 * Deriving also makes this suite exercise the mapping itself, which nothing
 * did. The renaming test below still builds its own set, which is the thing
 * that actually pins "every name is a setting".
 */
const PROPS: TripPropertyNames = tripPropertyNames(DEFAULT_SETTINGS);

function input(overrides: Partial<TripFrontmatterInput> = {}): TripFrontmatterInput {
  return {
    properties: PROPS,
    typeValue: 'trip',
    subtitle: null,
    image: null,
    highlights: [],
    gallery: [],
    countryTitle: null,
    cityTitles: [],
    departure: null,
    return: null,
    travelType: null,
    travelStatus: null,
    reviewStatus: null,
    rating: null,
    created: null,
    modified: null,
    personTitles: [],
    days: [],
    stops: [],
    nights: [],
    transport: [],
    currency: null,
    budget: [],
    rates: [],
    ...overrides,
  };
}

function roundTrip(overrides: Partial<TripFrontmatterInput> = {}) {
  return parseTripRecord({
    properties: PROPS,
    frontmatter: buildTripFrontmatter(input(overrides)),
  });
}

describe('buildTripFrontmatter', () => {
  it('writes only type for a trip with nothing filled in yet', () => {
    expect(buildTripFrontmatter(input())).toEqual({ type: 'trip' });
  });

  it('omits empty lists entirely rather than writing them as []', () => {
    const yaml = buildTripFrontmatter(input({ countryTitle: 'Switzerland' }));
    expect(yaml).toEqual({ type: 'trip', country: '[[Switzerland]]' });
    expect(Object.keys(yaml)).not.toContain('stops');
    expect(Object.keys(yaml)).not.toContain('nights');
    expect(Object.keys(yaml)).not.toContain('transport');
    expect(Object.keys(yaml)).not.toContain('persons');
  });

  it('puts type first so a raw note reads its own kind before anything else', () => {
    const yaml = buildTripFrontmatter(input({ countryTitle: 'Switzerland', rating: 4 }));
    expect(Object.keys(yaml)[0]).toBe('type');
  });

  it('writes datetimes as strings, so Obsidian YAML cannot coerce them to a Date', () => {
    const yaml = buildTripFrontmatter(input({ departure: '2026-02-13T09:00' }));
    expect(typeof yaml.departure).toBe('string');
    expect(yaml.departure).toBe('2026-02-13T09:00');
  });

  it('omits a stop sub-key rather than writing null for it', () => {
    const yaml = buildTripFrontmatter(
      input({
        stops: [aStopInput({ placeTitle: 'Restaurant Falknis' })],
      })
    );
    expect(yaml.stops).toEqual([{ place: '[[Restaurant Falknis]]' }]);
  });

  it('drops a stop with no place, since the place is the stop', () => {
    const yaml = buildTripFrontmatter(
      input({
        stops: [
          aStopInput({ placeTitle: '  ', from: '2026-02-13T12:00' }),
          aStopInput({ placeTitle: 'Basel' }),
        ],
      })
    );
    expect(yaml.stops).toEqual([{ place: '[[Basel]]' }]);
  });

  it('drops a transport leg that carries nothing but its own direction', () => {
    const yaml = buildTripFrontmatter(
      input({
        transport: [
          aLegInput({ direction: 'outbound' }),
          aLegInput({ direction: 'inbound', mode: 'car' }),
        ],
      })
    );
    expect(yaml.transport).toEqual([{ direction: 'inbound', mode: 'car' }]);
  });
});

describe('buildTripFrontmatter -> parseTripRecord round trip', () => {
  it('preserves a full day trip exactly', () => {
    const original = input({
      countryTitle: 'Switzerland',
      cityTitles: ['Landquart', 'Maienfeld'],
      departure: '2026-02-13T09:00',
      return: '2026-02-13T14:00',
      travelType: 'Private - Couple',
      travelStatus: 'Over',
      reviewStatus: 'Done',
      rating: 4,
      personTitles: ['Erika Muster', 'Stefan Muster'],
      stops: [
        {
          placeTitle: 'Landquart Fashion Outlet',
          day: null,
          from: '2026-02-13T09:30',
          to: '2026-02-13T11:30',
          note: 'Bought a pair of Diesel trousers',
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
          placeTitle: 'Restaurant Falknis',
          day: null,
          from: '2026-02-13T12:00',
          to: '2026-02-13T13:30',
          note: 'Angus beef fillet',
          rating: 5,
          motifName: null,
          // An entry priced per head: two people on the trip, and nobody
          // named on the stop, so it is for both of them.
          cost: 28,
          currency: 'CHF',
          costUnit: 'person',
          persons: [],
          variants: [],
          optional: false,
          chosen: false,
        },
      ],
    });
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: buildTripFrontmatter(original),
    });

    expect(parsed.countryTitle).toBe('Switzerland');
    expect(parsed.cityTitles).toEqual(['Landquart', 'Maienfeld']);
    expect(parsed.departure).toBe('2026-02-13T09:00');
    expect(parsed.return).toBe('2026-02-13T14:00');
    expect(parsed.travelStatus).toBe('Over');
    expect(parsed.rating).toBe(4);
    expect(parsed.personTitles).toEqual(['Erika Muster', 'Stefan Muster']);
    // `placeUnresolved` is derived on read and has no input of its own: it is
    // false for every stop whose place resolves, which is both of these.
    expect(parsed.stops).toEqual(original.stops.map((s) => ({ ...s, placeUnresolved: false })));
  });

  it('preserves nights and transport on a multi-day trip', () => {
    const parsed = roundTrip({
      nights: [
        {
          accommodationTitle: 'Hotel Dreieich',
          checkInDay: null,
          checkOutDay: null,
          checkIn: '2026-04-26',
          checkOut: '2026-04-28',
          cost: 240,
          currency: 'chf',
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
          mode: 'plane',
          carrier: 'Swiss',
          vehicleTitle: null,
          day: null,
          toDay: null,
          from: '2026-04-26T07:00',
          to: '2026-04-26T11:30',
          reference: null,
          origin: 'Zürich',
          destination: 'Pretoria',
          cost: 890,
          currency: null,
          costUnit: 'person',
          persons: [],
          variants: [],
          optional: false,
          chosen: false,
        },
        {
          direction: 'inbound',
          mode: 'train',
          carrier: null,
          vehicleTitle: 'Rovos Rail Pride of Africa',
          day: null,
          toDay: null,
          from: '2026-04-28T14:00',
          to: '2026-04-28T18:00',
          reference: 'IC 812',
          origin: null,
          destination: null,
          cost: null,
          currency: null,
          costUnit: 'total',
          // Only one of them took the train back, which is the case the
          // whole persons list exists for.
          persons: ['Stefan Muster'],
          variants: [],
          optional: false,
          chosen: false,
        },
      ],
    });

    expect(parsed.nights).toEqual([
      {
        accommodationTitle: 'Hotel Dreieich',
        // A stay that names its own dates says nothing about days of the
        // trip, and reads back as saying nothing.
        checkInDay: null,
        checkOutDay: null,
        checkIn: '2026-04-26',
        checkOut: '2026-04-28',
        cost: 240,
        // Written upper case, like every other currency this plugin stores.
        currency: 'CHF',
        // A room, per night, whoever is in it: 240 is not what the stay
        // costs, it is what a night of it costs.
        costUnit: 'night',
        persons: [],
        // The three shared sub-keys, saying nothing: one price, and a stay
        // that is going to happen. A note that writes none of them reads back
        // as exactly this.
        variants: [],
        optional: false,
        chosen: false,
      },
    ]);

    // Where a leg starts and ends, which neither its mode nor its times can
    // say. A flight from Zurich to Pretoria used to render as "Outward
    // journey" and a clock range.
    expect(parsed.transport[0].origin).toBe('Zürich');
    expect(parsed.transport[0].destination).toBe('Pretoria');
    expect(parsed.transport[0].cost).toBe(890);
    expect(parsed.transport[0].mode).toBe('plane');
    expect(parsed.transport[1].reference).toBe('IC 812');
    expect(parsed.transport[1].direction).toBe('inbound');

    // A fare is quoted per passenger, so the unit has to survive the write:
    // 890 for a party of two is 1780, and 890 in total is not.
    expect(parsed.transport[0].costUnit).toBe('person');
    // Naming nobody means everybody, and is written as nothing at all.
    expect(parsed.transport[0].persons).toEqual([]);
    expect(parsed.transport[1].persons).toEqual(['Stefan Muster']);
  });

  // A stop at a photo spot may name which motif it is for. The name is the
  // link, so it has to survive a write and a read unchanged, including the
  // case a spot's own motif list does not (yet) contain.
  it('preserves the motif a stop is for', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: buildTripFrontmatter(
        input({
          stops: [
            aStopInput({
              placeTitle: 'Neuchâtel',
              motifName: 'Pavillon des Bains, Chez-le-Bart',
            }),
          ],
        })
      ),
    });
    expect(parsed.stops[0].motifName).toBe('Pavillon des Bains, Chez-le-Bart');
  });

  // The plan and the rates are the trip's own money, and they have to survive
  // an edit to anything else on the note.
  it('preserves the budget, the rates and the trip currency', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: buildTripFrontmatter(
        input({
          currency: 'chf',
          budget: [
            { category: 'transport', amount: 400 },
            { category: 'accommodation', amount: 600 },
          ],
          rates: [{ currency: 'eur', rate: 0.94 }],
        })
      ),
    });

    // Written upper case, because an ISO code is upper case and a vault that
    // typed `chf` meant CHF.
    expect(parsed.currency).toBe('CHF');
    expect(parsed.budget).toEqual([
      { category: 'transport', amount: 400 },
      { category: 'accommodation', amount: 600 },
    ]);
    expect(parsed.rates).toEqual([{ currency: 'EUR', rate: 0.94 }]);
  });

  // The category IS the line: a ceiling that belongs to nothing is not a
  // budget line, the same way a stop with no place is not a stop.
  it('drops a budget line with no category or no amount', () => {
    const yaml = buildTripFrontmatter(
      input({
        budget: [
          { category: '', amount: 400 },
          { category: 'food', amount: null },
        ],
      })
    );
    expect(Object.keys(yaml)).not.toContain('budget');
  });

  it('round-trips through renamed property names', () => {
    const german: TripPropertyNames = {
      ...PROPS,
      personsProperty: 'personen',
      stopsProperty: 'stationen',
    };
    const yaml = buildTripFrontmatter(
      input({
        properties: german,
        personTitles: ['Erika Muster'],
        stops: [aStopInput({ placeTitle: 'Basel' })],
      })
    );
    expect(Object.keys(yaml)).toContain('personen');
    expect(Object.keys(yaml)).toContain('stationen');

    const parsed = parseTripRecord({ properties: german, frontmatter: yaml });
    expect(parsed.personTitles).toEqual(['Erika Muster']);
    expect(parsed.stops[0].placeTitle).toBe('Basel');
  });
});

describe('parseTripRecord', () => {
  it('reads an unrecognized travelStatus as null rather than passing it through', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: { type: 'trip', travelStatus: 'Somewhere In Between' },
    });
    expect(parsed.travelStatus).toBeNull();
  });

  it("keeps a stop whose place is malformed, so a typo doesn't look like a deletion", () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: {
        type: 'trip',
        stops: [{ place: 'Restaurant Falknis', from: '2026-02-13T12:00' }],
      },
    });
    expect(parsed.stops).toHaveLength(1);
    expect(parsed.stops[0].placeTitle).toBeNull();
    expect(parsed.stops[0].from).toBe('2026-02-13T12:00');
  });

  it('skips list entries that are not objects at all', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: { type: 'trip', stops: ['[[Basel]]', null, 42] },
    });
    expect(parsed.stops).toEqual([]);
  });

  it('reads a missing stops/nights/transport key as an empty list', () => {
    const parsed = parseTripRecord({ properties: PROPS, frontmatter: { type: 'trip' } });
    expect(parsed.stops).toEqual([]);
    expect(parsed.nights).toEqual([]);
    expect(parsed.transport).toEqual([]);
  });

  it('keeps the time on a datetime Obsidian handed back as a native Date', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: { type: 'trip', departure: new Date(2026, 1, 26, 8, 30) },
    });
    expect(parsed.departure).toBe('2026-02-26T08:30');
  });

  it('treats a leg with no explicit direction as outbound', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: { type: 'trip', transport: [{ mode: 'car' }] },
    });
    expect(parsed.transport[0].direction).toBe('outbound');
  });

  it('reads a rating typed as a string, as Obsidian often leaves it', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: { type: 'trip', rating: '4' },
    });
    expect(parsed.rating).toBe(4);
  });
});

describe('effectiveTravelStatus', () => {
  const today = '2026-08-06';

  it('uses an explicit status verbatim, whatever the dates say', () => {
    expect(
      effectiveTravelStatus(
        { travelStatus: 'Cancelled', departure: '2020-01-01', return: '2020-01-02' },
        today
      )
    ).toBe('Cancelled');
  });

  it('derives Over for a trip whose return date has passed', () => {
    expect(
      effectiveTravelStatus(
        { travelStatus: null, departure: '2026-02-13T09:00', return: '2026-02-13T14:00' },
        today
      )
    ).toBe('Over');
  });

  it('derives Planned for a future trip, never Booked -- booking is not a fact a date can reveal', () => {
    expect(
      effectiveTravelStatus(
        { travelStatus: null, departure: '2026-12-01', return: '2026-12-08' },
        today
      )
    ).toBe('Planned');
  });

  it('falls back to departure when there is no return date', () => {
    expect(
      effectiveTravelStatus({ travelStatus: null, departure: '2026-01-05', return: null }, today)
    ).toBe('Over');
  });

  it('treats a trip ending today as still current, not Over', () => {
    expect(
      effectiveTravelStatus({ travelStatus: null, departure: today, return: today }, today)
    ).toBe('Planned');
  });

  it('derives Planned for a trip with no dates at all', () => {
    expect(
      effectiveTravelStatus({ travelStatus: null, departure: null, return: null }, today)
    ).toBe('Planned');
  });
});

describe('tripManagedKeys', () => {
  it('lists every key the builder can emit, so an edit clears stale ones', () => {
    const full = buildTripFrontmatter(
      input({
        countryTitle: 'Switzerland',
        cityTitles: ['Basel'],
        departure: '2026-02-13T09:00',
        return: '2026-02-13T14:00',
        travelType: 'Private',
        travelStatus: 'Over',
        reviewStatus: 'Done',
        rating: 4,
        modified: '2026-08-06T10:00',
        personTitles: ['Erika Muster'],
        stops: [aStopInput({ placeTitle: 'Basel' })],
        nights: [aNightInput({ accommodationTitle: 'Hotel' })],
        transport: [aLegInput({ direction: 'outbound', mode: 'car' })],
      })
    );
    const managed = new Set(tripManagedKeys(PROPS));
    for (const key of Object.keys(full)) expect(managed.has(key)).toBe(true);
  });

  // The one key the builder can emit that must NOT be managed. Managed keys
  // are deleted before an edit rewrites the note, and an edit never re-emits
  // `created`, so listing it would strip the creation stamp off every trip
  // the first time it was saved.
  it('leaves createdProperty unmanaged, so an edit cannot strip the creation stamp', () => {
    expect(tripManagedKeys(PROPS)).not.toContain(PROPS.createdProperty);
  });
});

describe('the created stamp', () => {
  it('is emitted directly after type, so a note reads its kind then its age', () => {
    const yaml = buildTripFrontmatter(
      input({ created: '2026-08-12T09:15', countryTitle: 'Switzerland' })
    );
    expect(Object.keys(yaml).slice(0, 2)).toEqual(['type', 'created']);
    expect(yaml.created).toBe('2026-08-12T09:15');
  });

  it('is omitted when the edit path passes null, leaving whatever the note already holds', () => {
    const yaml = buildTripFrontmatter(input({ created: null, modified: '2026-08-12T09:15' }));
    expect(yaml.created).toBeUndefined();
    expect(yaml.modified).toBe('2026-08-12T09:15');
  });

  // A blank property name is a vault asking for no stamp, not a vault
  // asking for a key with an empty name.
  it('writes nothing at all when the property name is blank', () => {
    const yaml = buildTripFrontmatter({
      ...input({ created: '2026-08-12T09:15', modified: '2026-08-12T09:15' }),
      properties: { ...PROPS, createdProperty: '', modifiedProperty: '' },
    });
    expect(Object.keys(yaml)).toEqual(['type']);
  });
});

/**
 * What the trip says about itself, as against what happened on it.
 *
 * These four are the presentation fields: the line under the name, the picture,
 * the highlights and the gallery. They arrived together because a printed trip
 * sheet needs all four and the note carried none of them -- `image` was read as
 * a hardcoded key by one card and called cosmetic by the data model.
 *
 * The rules worth pinning are the ones that decide what reaches somebody's
 * note: a blank is not an entry, an entry with nothing to show is not an entry,
 * and an empty list is absent rather than `[]`.
 */
describe('the presentation fields', () => {
  it('round-trips all four', () => {
    const record = roundTrip({
      subtitle: 'Zugreise in Suedafrika',
      image: 'Trips/Shongololo/_resources/hero.jpg',
      highlights: ['Nostalgische Zugreise', 'Fish River Canyon'],
      gallery: [
        { image: 'Trips/Shongololo/_resources/1.jpg', caption: 'Sossusvlei' },
        { image: 'Trips/Shongololo/_resources/2.jpg', caption: null },
      ],
    });

    expect(record.subtitle).toBe('Zugreise in Suedafrika');
    expect(record.image).toBe('Trips/Shongololo/_resources/hero.jpg');
    expect(record.highlights).toEqual(['Nostalgische Zugreise', 'Fish River Canyon']);
    expect(record.gallery).toEqual([
      { image: 'Trips/Shongololo/_resources/1.jpg', caption: 'Sossusvlei' },
      { image: 'Trips/Shongololo/_resources/2.jpg', caption: null },
    ]);
  });

  /**
   * Asserted on the frontmatter rather than on a round trip. The parser drops
   * blanks too, so a round trip comes out clean whether or not the writer
   * filtered -- and the first version of this test passed with the writer's
   * filter deleted. What matters is what reaches the note.
   */
  it('drops a blank highlight rather than writing an empty bullet', () => {
    const yaml = buildTripFrontmatter(input({ highlights: ['One', '   ', '', 'Two'] }));

    expect(yaml.highlights).toEqual(['One', 'Two']);
  });

  /** A caption with no picture is a caption for nothing. */
  it('drops a gallery entry that names no picture', () => {
    const record = roundTrip({
      gallery: [
        { image: '   ', caption: 'Orphan' },
        { image: 'a.jpg', caption: null },
      ],
    });

    expect(record.gallery).toEqual([{ image: 'a.jpg', caption: null }]);
  });

  it('omits an empty list entirely rather than writing it as []', () => {
    const yaml = buildTripFrontmatter(input({ highlights: [], gallery: [] }));

    expect(yaml).not.toHaveProperty('highlights');
    expect(yaml).not.toHaveProperty('gallery');
  });

  it('omits a caption rather than writing null for it', () => {
    const yaml = buildTripFrontmatter(input({ gallery: [{ image: 'a.jpg', caption: null }] }));

    expect(yaml.gallery).toEqual([{ image: 'a.jpg' }]);
  });

  /**
   * A vault written by hand may say `highlights: One thing` rather than a list.
   * Reading that as nothing would lose it silently; reading it as one entry is
   * what somebody who typed it meant.
   */
  it('reads a single string as a list of one', () => {
    const record = parseTripRecord({
      properties: PROPS,
      frontmatter: { highlights: 'Nostalgische Zugreise' },
    });

    expect(record.highlights).toEqual(['Nostalgische Zugreise']);
  });

  it('reads a note that carries none of them', () => {
    const record = parseTripRecord({ properties: PROPS, frontmatter: {} });

    expect(record.subtitle).toBeNull();
    expect(record.image).toBeNull();
    expect(record.highlights).toEqual([]);
    expect(record.gallery).toEqual([]);
  });
});

/**
 * A line of a brochure day: a time and a sentence, and nowhere in particular.
 *
 * "16.30 Uhr: Der Nachmittagstee wird im Beobachtungswagen serviert" happens on
 * a moving train. The schema was designed around an itinerary where every entry
 * is a visit somewhere, and required a place for that reason; a brochure day is
 * not that. What survives of the old rule is the half that was doing the work:
 * an entry carrying only a time still says nothing.
 */
describe('a stop that names no place', () => {
  it('is kept when it carries a note', () => {
    const yaml = buildTripFrontmatter(
      input({
        stops: [
          {
            placeTitle: '',
            day: 1,
            from: '16:30',
            to: null,
            note: 'Der Nachmittagstee wird im Beobachtungswagen serviert.',
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
        ],
      })
    );

    expect(yaml.stops).toEqual([
      { day: 1, from: '16:30', note: 'Der Nachmittagstee wird im Beobachtungswagen serviert.' },
    ]);
  });

  it('is dropped when it is only a time', () => {
    const yaml = buildTripFrontmatter(
      input({
        stops: [
          {
            placeTitle: '',
            day: 1,
            from: '16:30',
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
          },
        ],
      })
    );

    expect(yaml.stops).toBeUndefined();
  });

  it('reads back as naming no place, rather than as an unresolved one', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: { stops: [{ day: 1, from: '16:30', note: 'Nachmittagstee' }] },
    });

    expect(parsed.stops[0].placeTitle).toBeNull();
    expect(parsed.stops[0].placeUnresolved).toBe(false);
  });

  /**
   * The distinction the flag exists for. Both read as a null title, and only
   * one of them is a note that needs fixing -- without this every brochure
   * line would render as "unresolved link".
   */
  it('is told apart from a place whose link is a typo', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: { stops: [{ place: '[[Unclosed', note: 'typo' }] },
    });

    expect(parsed.stops[0].placeTitle).toBeNull();
    expect(parsed.stops[0].placeUnresolved).toBe(true);
  });
});

/**
 * Who runs a leg: Swiss, Edelweiss, Rovos Rail.
 *
 * Free text read down from a wikilink, the rule `origin` and `destination`
 * already follow, and for the same reason: most airlines will never be a note
 * in anybody's vault, and a field that insisted on one is a field nobody fills
 * in. A named train and the company running it are the same answer often
 * enough that they share the field.
 */
describe('a leg that says who runs it', () => {
  it('writes the carrier as typed', () => {
    const yaml = buildTripFrontmatter(
      input({ transport: [aLegInput({ direction: 'outbound', carrier: 'Swiss' })] })
    );

    expect(yaml.transport).toEqual([{ direction: 'outbound', carrier: 'Swiss' }]);
  });

  it('reads a wikilink down to its target, like an origin', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: { transport: [{ direction: 'outbound', carrier: '[[Swiss]]' }] },
    });

    expect(parsed.transport[0].carrier).toBe('Swiss');
  });

  it('keeps plain text that names no note', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: { transport: [{ direction: 'outbound', carrier: 'Edelweiss' }] },
    });

    expect(parsed.transport[0].carrier).toBe('Edelweiss');
  });

  /** A leg is worth keeping when it says anything beyond its direction, and a carrier is something. */
  it('is enough on its own to keep a leg', () => {
    const yaml = buildTripFrontmatter(
      input({ transport: [aLegInput({ direction: 'inbound', carrier: 'Rovos Rail' })] })
    );

    expect(yaml.transport).toHaveLength(1);
  });
});

/**
 * A leg sold at more than one price.
 *
 * The note gains a list of fares under the leg rather than a second leg
 * beside it: three cabin categories on one voyage is one journey on one set
 * of days with a decision still open on it. Round-tripped through the real
 * builder and parser rather than asserted against hand-written frontmatter,
 * so a builder and a parser that disagree cannot both pass.
 */
describe('the prices a line can be bought at', () => {
  const FARES = [
    {
      name: 'Polar outside',
      description: 'Window, about 12 m²',
      cost: 4479,
      currency: 'CHF',
      costUnit: 'person' as const,
      chosen: true,
    },
    {
      name: 'Arctic superior',
      description: null,
      cost: 5299,
      currency: 'CHF',
      costUnit: 'person' as const,
      chosen: false,
    },
  ];

  it('writes them under the leg, in the order they were given', () => {
    const yaml = buildTripFrontmatter(
      input({ transport: [aLegInput({ carrier: 'Hurtigruten', variants: FARES })] })
    );
    const legs = yaml.transport as Record<string, unknown>[];

    expect(legs[0].variants).toEqual([
      {
        name: 'Polar outside',
        description: 'Window, about 12 m²',
        cost: 4479,
        costUnit: 'person',
        currency: 'CHF',
        chosen: true,
      },
      { name: 'Arctic superior', cost: 5299, costUnit: 'person', currency: 'CHF' },
    ]);
  });

  it('comes back the same way it went in', () => {
    const parsed = roundTrip({
      transport: [aLegInput({ carrier: 'Hurtigruten', variants: FARES })],
    });

    expect(parsed.transport[0].variants).toEqual(FARES);
  });

  /**
   * False on every fare is the ordinary state of a choice nobody has made,
   * and writing it five times would say it five times over.
   */
  it('writes chosen only where it is true', () => {
    const yaml = buildTripFrontmatter(
      input({ transport: [aLegInput({ variants: [{ ...FARES[1] }] })] })
    );
    const legs = yaml.transport as Record<string, unknown>[];
    const options = legs[0].variants as Record<string, unknown>[];

    expect(options[0]).not.toHaveProperty('chosen');
  });

  /** Opening an editor and leaving a row blank must not write anything into a note. */
  it('drops a fare that names neither a price nor a name', () => {
    const yaml = buildTripFrontmatter(
      input({
        transport: [
          aLegInput({
            carrier: 'Hurtigruten',
            variants: [
              {
                name: null,
                description: 'no',
                cost: null,
                currency: null,
                costUnit: 'person',
                chosen: false,
              },
            ],
          }),
        ],
      })
    );
    const legs = yaml.transport as Record<string, unknown>[];

    expect(legs[0]).not.toHaveProperty('variants');
  });

  /** A leg somebody has priced three ways has had real work done on it, whatever else it does not say yet. */
  it('is enough on its own to keep a leg', () => {
    const yaml = buildTripFrontmatter(
      input({ transport: [aLegInput({ variants: [{ ...FARES[0] }] })] })
    );

    expect(yaml.transport).toHaveLength(1);
  });

  it('is left off entirely by a leg with one price', () => {
    const yaml = buildTripFrontmatter(input({ transport: [aLegInput({ carrier: 'Swiss' })] }));
    const legs = yaml.transport as Record<string, unknown>[];

    expect(legs[0]).not.toHaveProperty('variants');
  });

  /** The same rule the parser applies to a stop whose link is a typo: a row that says something stays visible. */
  it('reads a hand-written fare that names only a price', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: { transport: [{ direction: 'outbound', variants: [{ cost: 3200 }] }] },
    });

    expect(parsed.transport[0].variants).toEqual([
      {
        name: null,
        description: null,
        cost: 3200,
        currency: null,
        costUnit: 'total',
        chosen: false,
      },
    ]);
  });
});

/**
 * A line that may not happen.
 *
 * Both flags are written only when they are true, which is what keeps a
 * fifteen-day itinerary from carrying forty lines of `optional: false`. And
 * `chosen` is meaningless on a line that was never in question, so it is
 * neither written nor read there -- a second way of saying "planned" is a
 * second thing to get wrong.
 */
describe('an optional line', () => {
  it('writes the flag on a stop, a stay and a leg alike', () => {
    const yaml = buildTripFrontmatter(
      input({
        stops: [aStopInput({ placeTitle: 'Tromsø', optional: true })],
        nights: [aNightInput({ accommodationTitle: 'Ice hotel', optional: true })],
        transport: [aLegInput({ carrier: 'Coach', optional: true })],
      })
    );

    for (const key of ['stops', 'nights', 'transport'] as const) {
      const entries = yaml[key] as Record<string, unknown>[];
      expect(entries[0].optional, key).toBe(true);
    }
  });

  it('writes nothing at all for an ordinary line', () => {
    const yaml = buildTripFrontmatter(input({ stops: [aStopInput({ placeTitle: 'Tromsø' })] }));
    const stops = yaml.stops as Record<string, unknown>[];

    expect(stops[0]).not.toHaveProperty('optional');
    expect(stops[0]).not.toHaveProperty('chosen');
  });

  it('writes chosen once the extra has been taken', () => {
    const yaml = buildTripFrontmatter(
      input({ stops: [aStopInput({ placeTitle: 'Tromsø', optional: true, chosen: true })] })
    );
    const stops = yaml.stops as Record<string, unknown>[];

    expect(stops[0].chosen).toBe(true);
  });

  /** A control whose value is ignored, in note form. Writing it would leave a word that means nothing where it stands. */
  it('never writes chosen on a line that is not optional', () => {
    const yaml = buildTripFrontmatter(
      input({ stops: [aStopInput({ placeTitle: 'Tromsø', chosen: true })] })
    );
    const stops = yaml.stops as Record<string, unknown>[];

    expect(stops[0]).not.toHaveProperty('chosen');
  });

  it('reads back the way it went in', () => {
    const parsed = roundTrip({
      stops: [aStopInput({ placeTitle: 'Tromsø', optional: true, chosen: true })],
    });

    expect(parsed.stops[0].optional).toBe(true);
    expect(parsed.stops[0].chosen).toBe(true);
  });

  /** A note hand-edited to say `chosen` on an ordinary stop is not a stop with a decision on it. */
  it('ignores chosen written by hand on a line that is not optional', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: { stops: [{ place: '[[Tromsø]]', chosen: true }] },
    });

    expect(parsed.stops[0].chosen).toBe(false);
  });

  /** An excursion somebody marked as offered and has not named yet is still work done on the note. */
  it('is enough on its own to keep a stop', () => {
    const yaml = buildTripFrontmatter(input({ stops: [aStopInput({ optional: true })] }));

    expect(yaml.stops).toHaveLength(1);
  });
});

/**
 * Which ship or train a leg is taken on.
 *
 * Its own sub-key rather than more work for `carrier`, which is who runs it:
 * Hurtigruten is not MS Trollfjord, and a leg often wants to say both.
 */
describe('the vehicle a leg is taken on', () => {
  it('is written as a wikilink and read back down to its title', () => {
    const parsed = roundTrip({
      transport: [aLegInput({ carrier: 'Hurtigruten', vehicleTitle: 'MS Trollfjord' })],
    });

    expect(parsed.transport[0].vehicleTitle).toBe('MS Trollfjord');
    expect(parsed.transport[0].carrier).toBe('Hurtigruten');
  });

  it('keeps plain text for a ship the vault has no note for', () => {
    const parsed = parseTripRecord({
      properties: PROPS,
      frontmatter: { transport: [{ direction: 'outbound', vehicle: 'A nameless riverboat' }] },
    });

    expect(parsed.transport[0].vehicleTitle).toBe('A nameless riverboat');
  });

  it('is left off entirely by a leg that names none', () => {
    const yaml = buildTripFrontmatter(input({ transport: [aLegInput({ carrier: 'Swiss' })] }));
    const legs = yaml.transport as Record<string, unknown>[];

    expect(legs[0]).not.toHaveProperty('vehicle');
  });

  /** A leg that says only which ship it is on is still a leg worth keeping. */
  it('is enough on its own to keep a leg', () => {
    const yaml = buildTripFrontmatter(
      input({ transport: [aLegInput({ vehicleTitle: 'MS Trollfjord' })] })
    );

    expect(yaml.transport).toHaveLength(1);
  });
});
