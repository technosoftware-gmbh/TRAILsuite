import { describe, expect, it, vi } from 'vitest';

// The `obsidian` package ships types only, no runtime -- see fake-vault.ts's
// own doc comment. stringifyYaml is the call that matters in this path: the
// `---` fence is trail-core's Obsidian adapter now, and it serialises with
// Obsidian's own writer. The stand-in here (`${key}: ${JSON.stringify(value)}`
// per line) is easy to assert against, not a faithful YAML serializer.
vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
  stringifyYaml: (obj: Record<string, unknown>) =>
    Object.entries(obj)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import {
  createAccommodationNote,
  createCityNote,
  createCountryNote,
  createFnbNote,
  createLandmarkNote,
  createLocationNote,
  createPhotoSpotNote,
  createStateNote,
} from '../src/vault/create-entities';
import { makeFakeVault } from './fake-vault';
import { TravelCity, TravelCountry, TravelState } from '../src/vault/types';

const settings = DEFAULT_SETTINGS;

function fakeCountry(title: string): TravelCountry {
  return {
    file: {} as never,
    title,
    capitalTitle: null,
    capital: null,
    stateTitles: [],
    states: [],
  };
}
function fakeState(title: string): TravelState {
  return {
    file: {} as never,
    title,
    countryTitle: null,
    country: null,
    capitalTitle: null,
    capital: null,
    cityTitles: [],
    cities: [],
  };
}
function fakeCity(title: string): TravelCity {
  return {
    file: {} as never,
    title,
    countryTitle: null,
    country: null,
    stateTitle: null,
    state: null,
    geoLocation: null,
    visited: false,
    lastVisit: null,
    visitedFromTrips: false,
    tags: [],
  };
}

/**
 * The it.each stamp cases below each build their own fake vault but still
 * need to assert against it afterwards, and it.each cannot carry one in
 * through the case tuple without constructing it at collection time.
 */
let lastVault = makeFakeVault();
function makeApp() {
  return lastVault.app;
}

describe('createCountryNote', () => {
  it('writes type, folder, and an empty rest block when no capital/states are given', async () => {
    const { app, created } = makeFakeVault();
    const file = await createCountryNote(app, settings, 'Austria');
    expect(file.path).toBe(`${settings.countriesFolder}/Austria.md`);
    expect(created[0].content).toContain('type: "country"');
    expect(created[0].content).not.toContain(settings.capitalProperty);
  });

  it('writes capital and states as wikilinks when given', async () => {
    const { app, created } = makeFakeVault();
    await createCountryNote(app, settings, 'Austria', fakeCity('Vienna'), [fakeState('Tyrol')]);
    const content = created[0].content;
    expect(content).toContain(`${settings.capitalProperty}: "[[Vienna]]"`);
    expect(content).toContain(`${settings.statesProperty}: ["[[Tyrol]]"]`);
  });
});

describe('createStateNote', () => {
  it('writes country and capital wikilinks into the states folder', async () => {
    const { app, created } = makeFakeVault();
    const file = await createStateNote(
      app,
      settings,
      'Tyrol',
      fakeCountry('Austria'),
      fakeCity('Innsbruck')
    );
    expect(file.path).toBe(`${settings.statesFolder}/Tyrol.md`);
    expect(created[0].content).toContain(`${settings.countryProperty}: "[[Austria]]"`);
    expect(created[0].content).toContain(`${settings.capitalProperty}: "[[Innsbruck]]"`);
  });
});

describe('createCityNote', () => {
  it('writes country and state wikilinks into the cities folder', async () => {
    const { app, created } = makeFakeVault();
    const file = await createCityNote(
      app,
      settings,
      'Innsbruck',
      fakeCountry('Austria'),
      fakeState('Tyrol')
    );
    expect(file.path).toBe(`${settings.citiesFolder}/Innsbruck.md`);
    expect(created[0].content).toContain(`${settings.stateProperty}: "[[Tyrol]]"`);
  });

  it('omits the state wikilink when no state is given (a country without that level)', async () => {
    const { app, created } = makeFakeVault();
    await createCityNote(app, settings, 'Vienna', fakeCountry('Austria'));
    expect(created[0].content).not.toContain(settings.stateProperty);
  });
});

describe('place-type note creation (Accommodation/FnB/Landmark/Location/Photo spot)', () => {
  const cases: [
    (
      app: Parameters<typeof createAccommodationNote>[0],
      settings: Parameters<typeof createAccommodationNote>[1],
      title: string,
      country?: TravelCountry | null,
      city?: TravelCity | null
    ) => ReturnType<typeof createAccommodationNote>,
    string,
    keyof typeof settings,
  ][] = [
    [createAccommodationNote, 'accommodation', 'accommodationFolder'],
    [createFnbNote, 'fnb', 'fnbFolder'],
    [createLandmarkNote, 'landmark', 'landmarksFolder'],
    [createLocationNote, 'location', 'locationsFolder'],
    [createPhotoSpotNote, 'photospot', 'photoSpotsFolder'],
  ];

  it.each(cases)(
    '%s: writes the matching type value into its own configured folder',
    async (fn, type, folderKey) => {
      const { app, created } = makeFakeVault();
      const file = await fn(
        app,
        settings,
        'Hotel Sacher',
        fakeCountry('Austria'),
        fakeCity('Vienna')
      );
      expect(file.path).toBe(`${settings[folderKey] as string}/Hotel Sacher.md`);
      expect(created[0].content).toContain(`type: "${type}"`);
      expect(created[0].content).toContain(`${settings.countryProperty}: "[[Austria]]"`);
      expect(created[0].content).toContain(`${settings.cityProperty}: "[[Vienna]]"`);
    }
  );

  it('falls back to just Country when no City is given (a place outside any tracked City)', async () => {
    const { app, created } = makeFakeVault();
    await createLandmarkNote(app, settings, 'Grossglockner', fakeCountry('Austria'));
    expect(created[0].content).toContain(`${settings.countryProperty}: "[[Austria]]"`);
    expect(created[0].content).not.toContain(settings.cityProperty);
  });
});

describe('the created stamp', () => {
  const NOW = new Date(2026, 7, 12, 9, 15);

  // Every creation path, so a type added later cannot quietly skip the
  // stamp: the four-argument wrappers all take `now` last.
  it.each([
    ['country', () => createCountryNote(makeApp(), settings, 'Austria', null, [], NOW)],
    ['state', () => createStateNote(makeApp(), settings, 'Tyrol', null, null, NOW)],
    ['city', () => createCityNote(makeApp(), settings, 'Vienna', null, null, NOW)],
    ['accommodation', () => createAccommodationNote(makeApp(), settings, 'H', null, null, NOW)],
    ['fnb', () => createFnbNote(makeApp(), settings, 'F', null, null, NOW)],
    ['landmark', () => createLandmarkNote(makeApp(), settings, 'L', null, null, NOW)],
    ['location', () => createLocationNote(makeApp(), settings, 'Lo', null, null, NOW)],
    ['photospot', () => createPhotoSpotNote(makeApp(), settings, 'P', null, null, NOW)],
  ] as [string, () => Promise<unknown>][])(
    '%s: stamps created and not modified',
    async (_t, run) => {
      lastVault = makeFakeVault();
      await run();
      const content = lastVault.created[0].content;
      expect(content).toContain('created: "2026-08-12T09:15"');
      expect(content).not.toContain('modified');
    }
  );

  it('puts created directly after type, before the entity fields', async () => {
    const { app, created } = makeFakeVault();
    await createCityNote(
      app,
      settings,
      'Innsbruck',
      fakeCountry('Austria'),
      fakeState('Tyrol'),
      NOW
    );
    const keys = created[0].content
      .split('---\n')[1]
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split(':')[0]);
    expect(keys.slice(0, 2)).toEqual(['type', 'created']);
  });

  // A cleared property name is a vault asking for no stamp, so nothing is
  // written -- never a fallback to a hardcoded `created:`.
  it('writes nothing when the property name has been cleared', async () => {
    const { app, created } = makeFakeVault();
    await createCountryNote(app, { ...settings, createdProperty: '' }, 'Austria', null, [], NOW);
    expect(created[0].content).not.toContain('created');
  });
});

describe('duplicate note guard', () => {
  it('refuses to overwrite a note that already exists at the target path', async () => {
    const { app } = makeFakeVault([
      { path: `${settings.countriesFolder}/Austria.md`, frontmatter: { type: 'country' } },
    ]);
    await expect(createCountryNote(app, settings, 'Austria')).rejects.toThrow(/already exists/);
  });
});
