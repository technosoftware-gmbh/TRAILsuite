/**
 * The three notes that hold the hierarchy together, written -- and what an
 * edit leaves alone.
 *
 * The rule with teeth here is the direction: a city names its state, and
 * nothing writes the list on the other side. Two of these tests exist to
 * make a future "while we are here, keep `cities:` in sync" go red.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import {
  buildRegionFrontmatter,
  cityToInput,
  countryToInput,
  RegionInput,
  regionManagedKeys,
  regionPropertyNames,
  stateToInput,
  updateRegionNote,
} from '../src/places/write-region';
import { TravelCity, TravelCountry, TravelState } from '../src/vault/types';

const settings = DEFAULT_SETTINGS;
const properties = regionPropertyNames(settings);
const NOW = new Date(2026, 8, 10, 9, 15);

function input(overrides: Partial<RegionInput> = {}): RegionInput {
  return {
    countryTitle: null,
    stateTitle: null,
    capitalTitle: null,
    geoLocation: null,
    tags: [],
    ...overrides,
  };
}

function vaultWithFrontmatter(frontmatter: Record<string, unknown>) {
  const file = { path: 'Places/Cities/Brugg.md', basename: 'Brugg' } as never;
  const app = {
    fileManager: {
      processFrontMatter: async (
        _f: unknown,
        fn: (fm: Record<string, unknown>) => void
      ): Promise<void> => {
        fn(frontmatter);
      },
    },
  } as never;
  return { app, file, frontmatter };
}

describe('buildRegionFrontmatter', () => {
  it('gives a city its country, its state, its coordinates and its tags', () => {
    const yaml = buildRegionFrontmatter(
      input({
        countryTitle: 'Switzerland',
        stateTitle: 'Aargau',
        geoLocation: ['47.4818', '8.2085'],
        tags: ['home', ' river '],
        // Carried and not written: a city has no capital, and the fixture
        // has to say so or a writer that wrote one anyway would pass.
        capitalTitle: 'nonsense',
      }),
      'city',
      properties
    );

    expect(yaml.country).toBe('[[Switzerland]]');
    expect(yaml.state).toBe('[[Aargau]]');
    expect(yaml.geoLocation).toEqual(['47.4818', '8.2085']);
    expect(yaml.tags).toEqual(['home', 'river']);
    expect('capital' in yaml).toBe(false);
  });

  it('gives a state its country and its capital, and nothing a city carries', () => {
    const yaml = buildRegionFrontmatter(
      input({
        countryTitle: 'Switzerland',
        capitalTitle: 'Aarau',
        stateTitle: 'nonsense',
        geoLocation: ['47.4818', '8.2085'],
        tags: ['ignored'],
      }),
      'state',
      properties
    );

    expect(yaml.country).toBe('[[Switzerland]]');
    expect(yaml.capital).toBe('[[Aarau]]');
    expect('state' in yaml).toBe(false);
    expect('geoLocation' in yaml).toBe(false);
    expect('tags' in yaml).toBe(false);
  });

  it('gives a country its capital and no country of its own', () => {
    const yaml = buildRegionFrontmatter(
      input({ capitalTitle: 'Bern', countryTitle: 'nonsense' }),
      'country',
      properties
    );

    expect(yaml.capital).toBe('[[Bern]]');
    expect('country' in yaml).toBe(false);
  });

  it('omits what was left empty rather than writing it blank', () => {
    expect(buildRegionFrontmatter(input({ capitalTitle: '  ' }), 'country', properties)).toEqual(
      {}
    );
  });

  it('does not write half a coordinate', () => {
    const yaml = buildRegionFrontmatter(
      input({ geoLocation: ['47.4818', ' '] }),
      'city',
      properties
    );
    expect('geoLocation' in yaml).toBe(false);
  });

  it('honours renamed property names', () => {
    const renamed = regionPropertyNames({ ...settings, capitalProperty: 'hauptstadt' });
    const yaml = buildRegionFrontmatter(input({ capitalTitle: 'Bern' }), 'country', renamed);
    expect(yaml.hauptstadt).toBe('[[Bern]]');
    expect('capital' in yaml).toBe(false);
  });
});

describe('regionManagedKeys', () => {
  /**
   * The direction rule, as a key list. A country's `states:` and a state's
   * `cities:` are read and never written, so they are not this schema's to
   * clear either.
   */
  it('never claims a child list', () => {
    for (const kind of ['country', 'state', 'city'] as const) {
      expect(regionManagedKeys(kind, properties), kind).not.toContain(settings.statesProperty);
      expect(regionManagedKeys(kind, properties), kind).not.toContain(settings.citiesProperty);
    }
  });

  it('claims only what its own kind writes', () => {
    expect(regionManagedKeys('country', properties)).toEqual(['capital']);
    expect(regionManagedKeys('state', properties)).toEqual(['country', 'capital']);
    expect(regionManagedKeys('city', properties)).toEqual([
      'country',
      'state',
      'geoLocation',
      'tags',
    ]);
  });

  it('never claims visited or lastVisit', () => {
    for (const kind of ['country', 'state', 'city'] as const) {
      const keys = regionManagedKeys(kind, properties);
      expect(keys).not.toContain(settings.visitedProperty);
      expect(keys).not.toContain(settings.lastVisitProperty);
    }
  });
});

describe('updateRegionNote', () => {
  it('leaves frontmatter it does not own completely alone', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'city',
      image: 'Attachments/brugg.jpg',
      gallery: [{ image: 'Attachments/altstadt.jpg', caption: 'Altstadt' }],
      description: 'On the Aare, where the bridge is.',
      created: '2026-08-04T16:29',
      visited: true,
      lastVisit: '2026-05-02',
    });

    await updateRegionNote(
      app,
      settings,
      file,
      'city',
      input({ countryTitle: 'Switzerland' }),
      undefined,
      NOW
    );

    expect(frontmatter.image).toBe('Attachments/brugg.jpg');
    expect(frontmatter.gallery).toEqual([
      { image: 'Attachments/altstadt.jpg', caption: 'Altstadt' },
    ]);
    expect(frontmatter.description).toBe('On the Aare, where the bridge is.');
    expect(frontmatter.created).toBe('2026-08-04T16:29');
    expect(frontmatter.visited).toBe(true);
    expect(frontmatter.lastVisit).toBe('2026-05-02');
    expect(frontmatter.country).toBe('[[Switzerland]]');
  });

  /** The one that would hurt: a state's `cities:` list survives an edit that had no business touching it. */
  it('leaves a child list exactly where it found it', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'state',
      cities: ['[[Aarau]]', '[[Brugg]]'],
    });

    await updateRegionNote(
      app,
      settings,
      file,
      'state',
      input({ capitalTitle: 'Aarau' }),
      undefined,
      NOW
    );

    expect(frontmatter.cities).toEqual(['[[Aarau]]', '[[Brugg]]']);
  });

  it('clears a key it owns when the new value is empty', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'city',
      state: '[[Aargau]]',
      tags: ['home'],
    });

    await updateRegionNote(app, settings, file, 'city', input(), undefined, NOW);

    expect('state' in frontmatter).toBe(false);
    expect('tags' in frontmatter).toBe(false);
  });

  it('stamps modified, and skips it when the setting is blank', async () => {
    const stamped = vaultWithFrontmatter({ type: 'country' });
    await updateRegionNote(stamped.app, settings, stamped.file, 'country', input(), undefined, NOW);
    expect(stamped.frontmatter.modified).toBe('2026-09-10T09:15');

    const unstamped = vaultWithFrontmatter({ type: 'country' });
    await updateRegionNote(
      unstamped.app,
      { ...settings, modifiedProperty: '' },
      unstamped.file,
      'country',
      input(),
      undefined,
      NOW
    );
    expect('modified' in unstamped.frontmatter).toBe(false);
  });
});

describe('reading one back', () => {
  it('round-trips a city', () => {
    const city = {
      countryTitle: 'Switzerland',
      stateTitle: 'Aargau',
      geoLocation: ['47.4818', '8.2085'],
      tags: ['home'],
    } as unknown as TravelCity;

    expect(cityToInput(city)).toEqual({
      countryTitle: 'Switzerland',
      stateTitle: 'Aargau',
      capitalTitle: null,
      geoLocation: ['47.4818', '8.2085'],
      tags: ['home'],
    });
  });

  it('round-trips a state without its cities', () => {
    const state = {
      countryTitle: 'Switzerland',
      capitalTitle: 'Aarau',
      cityTitles: ['Aarau', 'Brugg'],
    } as unknown as TravelState;

    const back = stateToInput(state);
    expect(back.countryTitle).toBe('Switzerland');
    expect(back.capitalTitle).toBe('Aarau');
    expect(Object.values(back)).not.toContain('Brugg');
  });

  it('round-trips a country without its states', () => {
    const country = {
      capitalTitle: 'Bern',
      stateTitles: ['Aargau'],
    } as unknown as TravelCountry;

    const back = countryToInput(country);
    expect(back.capitalTitle).toBe('Bern');
    expect(back.countryTitle).toBeNull();
    expect(Object.values(back)).not.toContain('Aargau');
  });

  it('copies the arrays it carries', () => {
    const city = { tags: ['home'], geoLocation: ['1', '2'] } as unknown as TravelCity;
    const first = cityToInput(city);
    first.tags.push('late');
    expect(city.tags).toEqual(['home']);
  });
});
