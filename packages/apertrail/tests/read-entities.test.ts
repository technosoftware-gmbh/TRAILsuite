import { describe, expect, it, vi } from 'vitest';

// read-entities.ts names 'obsidian' only for types, but its module graph
// reaches the package for real through shared/vault-host.ts, which builds
// trail-core's Obsidian adapter. The package ships type definitions and no
// runtime, hence the mock -- see tests/obsidian-stub.ts for how the same
// specifier is made resolvable from inside the linked core.
vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { readTravelBoard } from '../src/vault/read-entities';
import { makeFakeVault } from './fake-vault';
import { cabinDescription } from '../src/places/vehicle-note';

const settings = DEFAULT_SETTINGS;

describe('readTravelBoard', () => {
  it('resolves the Country<->State<->City cycle and Place/Trip references', () => {
    const { app } = makeFakeVault([
      {
        path: `${settings.countriesFolder}/Austria.md`,
        frontmatter: { type: 'country', capital: '[[Vienna]]', states: ['[[Tyrol]]'] },
      },
      {
        path: `${settings.statesFolder}/Tyrol.md`,
        frontmatter: {
          type: 'state',
          country: '[[Austria]]',
          capital: '[[Innsbruck]]',
          cities: ['[[Innsbruck]]'],
        },
      },
      {
        path: `${settings.citiesFolder}/Vienna.md`,
        frontmatter: { type: 'city', country: '[[Austria]]' },
      },
      {
        path: `${settings.citiesFolder}/Innsbruck.md`,
        frontmatter: { type: 'city', country: '[[Austria]]', state: '[[Tyrol]]' },
      },
      {
        path: `${settings.landmarksFolder}/Stephansdom.md`,
        frontmatter: {
          type: 'landmark',
          country: '[[Austria]]',
          city: '[[Vienna]]',
          rating: 5,
          visited: true,
          geoLocation: ['48.2081', '16.3713'],
        },
      },
      {
        path: `${settings.tripsFolder}/Vienna 2026.md`,
        frontmatter: { type: 'trip', country: '[[Austria]]', departure: '2026-08-01' },
      },
    ]);

    const board = readTravelBoard(app, settings);

    const austria = board.countries.find((c) => c.title === 'Austria');
    expect(austria.capital?.title).toBe('Vienna');
    expect(austria.states.map((s) => s.title)).toEqual(['Tyrol']);

    const tyrol = board.states.find((s) => s.title === 'Tyrol');
    // The state's own `country:` link resolves back to the very same
    // Country object `austria.states` above points at -- this is the cycle
    // read-entities.ts's two-pass resolution exists to break.
    expect(tyrol.country).toBe(austria);
    expect(tyrol.capital?.title).toBe('Innsbruck');
    expect(tyrol.cities.map((c) => c.title)).toEqual(['Innsbruck']);

    const innsbruck = board.cities.find((c) => c.title === 'Innsbruck');
    expect(innsbruck.country?.title).toBe('Austria');
    expect(innsbruck.state).toBe(tyrol);

    const vienna = board.cities.find((c) => c.title === 'Vienna');
    expect(vienna.state).toBeNull();

    expect(board.places).toHaveLength(1);
    const landmark = board.places[0];
    expect(landmark.kind).toBe('landmark');
    expect(landmark.country?.title).toBe('Austria');
    expect(landmark.city?.title).toBe('Vienna');
    expect(landmark.rating).toBe(5);
    expect(landmark.visited).toBe(true);
    expect(landmark.geoLocation).toEqual(['48.2081', '16.3713']);

    expect(board.trips).toHaveLength(1);
    expect(board.trips[0].country?.title).toBe('Austria');
    expect(board.trips[0].departure).toBe('2026-08-01');
  });

  // Photo spot is the fifth member of the place family, so the only thing
  // worth asserting is that membership: it must come back in board.places
  // with the same resolved shape the other four get, without a line of
  // type-specific reading code. See docs/design/photo-spots.md §1.
  it('reads a photo spot as a place, with the same resolved shape as the other place types', () => {
    const { app } = makeFakeVault([
      {
        path: `${settings.countriesFolder}/Switzerland.md`,
        frontmatter: { type: 'country' },
      },
      {
        path: `${settings.citiesFolder}/Neuchatel.md`,
        frontmatter: { type: 'city', country: '[[Switzerland]]' },
      },
      {
        path: `${settings.photoSpotsFolder}/Neuchatel.md`,
        frontmatter: {
          type: 'photospot',
          country: '[[Switzerland]]',
          city: '[[Neuchatel]]',
          rating: 5,
          visited: true,
          geoLocation: ['46.9899', '6.9293'],
          website: 'https://www.neuchatelville.ch',
        },
      },
    ]);

    const board = readTravelBoard(app, settings);
    expect(board.places).toHaveLength(1);
    const spot = board.places[0];
    expect(spot.kind).toBe('photospot');
    expect(spot.country?.title).toBe('Switzerland');
    expect(spot.city?.title).toBe('Neuchatel');
    expect(spot.rating).toBe(5);
    expect(spot.visited).toBe(true);
    expect(spot.geoLocation).toEqual(['46.9899', '6.9293']);
    expect(spot.website).toBe('https://www.neuchatelville.ch');
    // Subtype fields belong to Accommodation and FnB, and stay null here
    // rather than being invented for a kind that has no use for them.
    expect(spot.accommodationType).toBeNull();
    expect(spot.fnbType).toBeNull();
  });

  it('leaves a wikilink target unresolved as null when it points at a note that was not found', () => {
    const { app } = makeFakeVault([
      {
        path: `${settings.countriesFolder}/Austria.md`,
        frontmatter: { type: 'country', capital: '[[Nonexistent City]]' },
      },
    ]);
    const board = readTravelBoard(app, settings);
    expect(board.countries[0].capitalTitle).toBe('Nonexistent City');
    expect(board.countries[0].capital).toBeNull();
  });

  it('excludes notes in a Travel folder whose type value does not match', () => {
    const { app } = makeFakeVault([
      { path: `${settings.countriesFolder}/scratch-note.md`, frontmatter: { type: 'note' } },
      { path: `${settings.countriesFolder}/Austria.md`, frontmatter: { type: 'country' } },
    ]);
    const board = readTravelBoard(app, settings);
    expect(board.countries.map((c) => c.title)).toEqual(['Austria']);
  });

  /**
   * A property editor types a property as a list the moment somebody adds a
   * second value, and a wikilink-shaped type value is what a vault that
   * keeps a note per type ends up with. Neither is a decision anybody made
   * about this note, and a City that vanished from the board for either
   * reason would be near impossible to attribute to its `type:`.
   */
  it('still counts a note whose type value is list-shaped or a wikilink', () => {
    const { app } = makeFakeVault([
      { path: `${settings.citiesFolder}/Vienna.md`, frontmatter: { type: ['city'] } },
      { path: `${settings.citiesFolder}/Graz.md`, frontmatter: { type: ['city', 'draft'] } },
      { path: `${settings.citiesFolder}/Linz.md`, frontmatter: { type: '[[city]]' } },
      { path: `${settings.citiesFolder}/Notes.md`, frontmatter: { type: ['note'] } },
    ]);
    const board = readTravelBoard(app, settings);
    expect(board.cities.map((c) => c.title)).toEqual(['Graz', 'Linz', 'Vienna']);
  });

  it('treats a non-wikilink-shaped value the same as absent, rather than guessing at a target', () => {
    const { app } = makeFakeVault([
      {
        path: `${settings.landmarksFolder}/Free Text Country.md`,
        frontmatter: { type: 'landmark', country: 'Austria' },
      },
    ]);
    const board = readTravelBoard(app, settings);
    expect(board.places[0].countryTitle).toBeNull();
    expect(board.places[0].country).toBeNull();
  });

  // findValue() skips a value that is blank as well as one that is missing,
  // so a property somebody cleared in the property editor (which leaves the
  // key behind with an empty value) reads as unset rather than as ''. Every
  // reader downstream already turned '' into null on its own, so this asserts
  // that the two paths still agree rather than that anything changed.
  it('reads a property left blank exactly as it reads one that is absent', () => {
    const { app } = makeFakeVault([
      {
        path: `${settings.citiesFolder}/Blank.md`,
        frontmatter: { type: 'city', country: '', state: '', visited: '', lastVisit: '' },
      },
      {
        path: `${settings.landmarksFolder}/Blank Place.md`,
        frontmatter: {
          type: 'landmark',
          country: '',
          city: '',
          address: '',
          website: '',
          rating: '',
          geoLocation: '',
        },
      },
    ]);

    const board = readTravelBoard(app, settings);

    const city = board.cities[0];
    expect(city.countryTitle).toBeNull();
    expect(city.stateTitle).toBeNull();
    expect(city.visited).toBe(false);
    expect(city.lastVisit).toBeNull();

    const place = board.places[0];
    expect(place.countryTitle).toBeNull();
    expect(place.cityTitle).toBeNull();
    expect(place.address).toBeNull();
    expect(place.website).toBeNull();
    expect(place.rating).toBeNull();
    expect(place.geoLocation).toBeNull();
  });

  // A blank value falls through to the NEXT candidate name, but every call
  // site here passes exactly one, so 0 and false have to survive the skip:
  // they are answers, not absences.
  it('keeps a zero rating and an explicit false, which are values rather than blanks', () => {
    const { app } = makeFakeVault([
      {
        path: `${settings.landmarksFolder}/Zero.md`,
        frontmatter: { type: 'landmark', rating: 0, visited: false },
      },
    ]);

    const board = readTravelBoard(app, settings);
    expect(board.places[0].rating).toBe(0);
    expect(board.places[0].visited).toBe(false);
  });

  it('reads a malformed or missing geoLocation as null rather than throwing', () => {
    const { app } = makeFakeVault([
      {
        path: `${settings.locationsFolder}/No Coords.md`,
        frontmatter: { type: 'location' },
      },
      {
        path: `${settings.locationsFolder}/Bad Coords.md`,
        frontmatter: { type: 'location', geoLocation: 'not-an-array' },
      },
    ]);
    const board = readTravelBoard(app, settings);
    expect(board.places.every((p) => p.geoLocation === null)).toBe(true);
  });
});

/**
 * The whole chain, read off a vault rather than assembled by hand: a ship
 * note, a trip whose leg names it, and the cabin description arriving on the
 * trip's own variant without either note carrying it twice.
 */
describe('a leg on a ship', () => {
  const vault = () =>
    makeFakeVault([
      {
        path: `${settings.vehiclesFolder}/MS Trollfjord.md`,
        frontmatter: {
          type: 'vehicle',
          mode: 'boat',
          operator: '[[Hurtigruten]]',
          capacity: 500,
          cabins: [
            { name: 'Polar Aussenkabine', description: 'Outside cabin with a window.' },
            { name: 'Arktis Superior', description: 'Larger, upper deck.' },
          ],
        },
      },
      {
        path: `${settings.tripsFolder}/Nordkap.md`,
        frontmatter: {
          type: 'trip',
          transport: [
            {
              direction: 'outbound',
              carrier: 'Hurtigruten',
              vehicle: '[[MS Trollfjord]]',
              day: 1,
              toDay: 15,
              currency: 'CHF',
              variants: [{ name: 'Polar Aussenkabine', cost: 4479, costUnit: 'person' }],
            },
          ],
        },
      },
    ]);

  it('reads the ship, its operator and its catalogue', () => {
    const board = readTravelBoard(vault().app, settings);
    const ship = board.vehicles[0];

    expect(ship?.title).toBe('MS Trollfjord');
    expect(ship?.operatorTitle).toBe('Hurtigruten');
    expect(ship?.capacity).toBe(500);
    expect(ship?.cabins.map((cabin) => cabin.name)).toEqual([
      'Polar Aussenkabine',
      'Arktis Superior',
    ]);
  });

  it('resolves the leg to it, and keeps the title either way', () => {
    const board = readTravelBoard(vault().app, settings);
    const leg = board.trips[0]?.transport[0];

    expect(leg?.vehicleTitle).toBe('MS Trollfjord');
    expect(leg?.vehicle?.title).toBe('MS Trollfjord');
  });

  /**
   * The point of the whole arrangement: the price is written on the trip, the
   * description is written on the ship, and neither note carries the other's.
   */
  it('lets the trip variant borrow the cabin description', () => {
    const board = readTravelBoard(vault().app, settings);
    const leg = board.trips[0]?.transport[0];

    expect(leg?.variants[0]?.cost).toBe(4479);
    expect(leg?.variants[0]?.description).toBeNull();
    expect(cabinDescription(leg?.vehicle ?? null, leg?.variants[0]?.name ?? null)).toBe(
      'Outside cabin with a window.'
    );
  });

  it('leaves the leg unresolved, and readable, for a ship the vault has no note for', () => {
    const { app } = makeFakeVault([
      {
        path: `${settings.tripsFolder}/Nordkap.md`,
        frontmatter: {
          type: 'trip',
          transport: [{ direction: 'outbound', vehicle: 'A nameless riverboat' }],
        },
      },
    ]);
    const leg = readTravelBoard(app, settings).trips[0]?.transport[0];

    expect(leg?.vehicleTitle).toBe('A nameless riverboat');
    expect(leg?.vehicle).toBeNull();
  });
});
