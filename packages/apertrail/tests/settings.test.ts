import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

/**
 * Every folder that hangs off the Places root, **derived** rather than typed.
 *
 * It was a hand-typed list, and note 38 records what that cost: `vehiclesFolder`
 * was added to the settings and not to the list, the merge fell back to the
 * English default while a German vault already called its root "Plätze", and
 * this is the test that existed to say so and could not. `settings-coverage`
 * and `settings-reference` both derive their lists from `DEFAULT_SETTINGS` and
 * both caught their own gaps the same afternoon; this one now does too, so the
 * next folder added under Places is covered by having been added.
 *
 * A membership check guards the derivation itself: a scan that silently
 * matched nothing would make every assertion below vacuous, which is this
 * package's own recurring defect shape in a test.
 */
const PLACES_SUBFOLDER_KEYS = (
  Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[]
).filter(
  (key): key is PlacesSubfolderKey =>
    key.endsWith('Folder') &&
    typeof DEFAULT_SETTINGS[key] === 'string' &&
    DEFAULT_SETTINGS[key].startsWith(`${DEFAULT_SETTINGS.placesFolder}/`)
);

type PlacesSubfolderKey = {
  [K in keyof typeof DEFAULT_SETTINGS]: (typeof DEFAULT_SETTINGS)[K] extends string ? K : never;
}[keyof typeof DEFAULT_SETTINGS];

const CRM_SUBFOLDER_KEYS = ['personsFolder', 'companiesFolder'] as const;

describe('the Places sub-folder scan', () => {
  it('finds the folders it exists to check, so the assertions below cannot be vacuous', () => {
    expect(PLACES_SUBFOLDER_KEYS.length).toBeGreaterThanOrEqual(10);
    // Two named on purpose: the oldest member, and the one whose absence from
    // the hand-typed version of this list shipped a bug.
    expect(PLACES_SUBFOLDER_KEYS).toContain('countriesFolder');
    expect(PLACES_SUBFOLDER_KEYS).toContain('vehiclesFolder');
    expect(PLACES_SUBFOLDER_KEYS).toContain('excursionsFolder');
    // And the Places root itself is not one of its own sub-folders.
    expect(PLACES_SUBFOLDER_KEYS).not.toContain('placesFolder');
  });
});

describe('mergeSettings -- module folders and property names', () => {
  it('returns the static English module defaults when given no seed at all', () => {
    const settings = mergeSettings(null);
    expect(settings.rootFolder).toBe(DEFAULT_SETTINGS.rootFolder);
    expect(settings.tripsFolder).toBe(DEFAULT_SETTINGS.tripsFolder);
    expect(settings.placesFolder).toBe(DEFAULT_SETTINGS.placesFolder);
    expect(settings.crmFolder).toBe(DEFAULT_SETTINGS.crmFolder);
  });

  /**
   * The three modules sit at the vault root out of the box, which is the
   * shape the sample vault ships in. An empty common parent must not leak
   * a leading slash into any path.
   */
  it('puts Trips, Places and CRM at the vault root by default', () => {
    const settings = mergeSettings(null);
    expect(settings.rootFolder).toBe('');
    expect(settings.tripsFolder).toBe('Trips');
    expect(settings.placesFolder).toBe('Places');
    expect(settings.crmFolder).toBe('CRM');
    for (const key of [...PLACES_SUBFOLDER_KEYS, ...CRM_SUBFOLDER_KEYS]) {
      expect(settings[key].startsWith('/')).toBe(false);
    }
  });

  it('derives every Places sub-folder from the resolved Places root, not an independent literal', () => {
    const settings = mergeSettings({ placesFolder: 'Atlas' });
    for (const key of PLACES_SUBFOLDER_KEYS) {
      expect(settings[key].startsWith('Atlas/')).toBe(true);
    }
  });

  it('derives every CRM sub-folder from the resolved CRM root', () => {
    const settings = mergeSettings({ crmFolder: 'Contacts' });
    for (const key of CRM_SUBFOLDER_KEYS) {
      expect(settings[key].startsWith('Contacts/')).toBe(true);
    }
  });

  it('moves all three modules under a common parent when one is configured', () => {
    const settings = mergeSettings({ rootFolder: '4 Resources/Travel' });
    expect(settings.tripsFolder).toBe('4 Resources/Travel/Trips');
    expect(settings.placesFolder).toBe('4 Resources/Travel/Places');
    expect(settings.crmFolder).toBe('4 Resources/Travel/CRM');
    expect(settings.photoSpotsFolder).toBe('4 Resources/Travel/Places/Photo Spots');
    expect(settings.personsFolder).toBe('4 Resources/Travel/CRM/People');
  });

  /**
   * The bug this guards: photoSpotsFolder was the first sub-folder setting
   * added after vaults were already configured, and it fell back under the
   * pristine default root rather than under the root everything else lives
   * in. A vault whose Places tree sits at "Orte" ended up scanning
   * "Places/Photo Spots" for photo spots, so the notes were in one tree and
   * the plugin was looking in another. The same trap applies to every
   * sub-folder added after a vault was configured, in any of the modules.
   */
  it('puts a sub-folder the saved settings never had under the saved module root, not the default one', () => {
    const settings = mergeSettings({ placesFolder: 'Orte', crmFolder: 'Kontakte' });
    expect(settings.photoSpotsFolder.startsWith('Orte/')).toBe(true);
    expect(settings.companiesFolder.startsWith('Kontakte/')).toBe(true);
  });

  it('still uses the default module root when the saved one is blank', () => {
    expect(mergeSettings({ placesFolder: '   ' }).photoSpotsFolder).toBe(
      DEFAULT_SETTINGS.photoSpotsFolder
    );
    expect(mergeSettings(null).photoSpotsFolder).toBe(DEFAULT_SETTINGS.photoSpotsFolder);
  });

  it('preserves explicitly-saved folder and property-name values on round-trip', () => {
    const seed = {
      tripsFolder: 'Journeys',
      countriesFolder: 'Atlas/Nations',
      countryProperty: 'destinationCountry',
      typePropertyName: 'kind',
    };
    const settings = mergeSettings(seed);
    expect(settings.tripsFolder).toBe('Journeys');
    expect(settings.countriesFolder).toBe('Atlas/Nations');
    expect(settings.countryProperty).toBe('destinationCountry');
    expect(settings.typePropertyName).toBe('kind');
    // Untouched sibling fields still fall back to their own defaults rather
    // than being wiped out by the partial seed.
    expect(settings.stateProperty).toBe(DEFAULT_SETTINGS.stateProperty);
    expect(settings.statesFolder).toBe(DEFAULT_SETTINGS.statesFolder);
  });

  it('falls back to the default property name for a non-string seed value', () => {
    const settings = mergeSettings({ ratingProperty: 42 });
    expect(settings.ratingProperty).toBe(DEFAULT_SETTINGS.ratingProperty);
  });

  it('defaults showRibbonIcon to true and preserves an explicit false', () => {
    expect(mergeSettings(null).showRibbonIcon).toBe(true);
    expect(mergeSettings({ showRibbonIcon: false }).showRibbonIcon).toBe(false);
  });

  it('carries the CRM person and company type values', () => {
    expect(mergeSettings(null).personTypeValue).toBe('person');
    expect(mergeSettings(null).companyTypeValue).toBe('company');
    expect(mergeSettings({ companyTypeValue: 'Organisation' }).companyTypeValue).toBe(
      'Organisation'
    );
  });
});
