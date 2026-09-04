/**
 * The fresh-install adoption of a sibling plugin's CRM settings.
 *
 * The behaviour worth pinning is as much what it refuses to do as what it
 * does: it reads a file rather than a plugin, it adopts folder paths and type
 * values and nothing else, and every failure mode looks like a fresh vault
 * rather than an error.
 */
import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { importForeignCrmSettings } from '../src/settings/foreign-settings-import';
import { mergeSettings } from '../src/settings/validate';

/**
 * A deliberately non-default config folder.
 *
 * Obsidian lets a vault rename `.obsidian`, and the import reads
 * `app.vault.configDir` rather than assuming the default. Using an unusual
 * value here is what actually proves that: a build that hardcoded the usual
 * name would find nothing and every test below would return null.
 */
const configDir = '.obsidian-renamed';

/** A vault whose only readable files are the sibling data.json blobs handed in here. */
function fakeApp(files: Record<string, string>): App {
  return {
    vault: {
      configDir,
      adapter: {
        exists: (path: string) => Promise.resolve(path in files),
        read: (path: string) => Promise.resolve(files[path]),
      },
    },
  } as unknown as App;
}

const apertrailPath = `${configDir}/plugins/apertrail/data.json`;

describe('importForeignCrmSettings', () => {
  it('returns null when no sibling is installed', async () => {
    expect(await importForeignCrmSettings(fakeApp({}))).toBeNull();
  });

  it('returns null rather than throwing on an unreadable or invalid file', async () => {
    // An absent sibling and a corrupt one must be indistinguishable from a
    // genuinely fresh vault, or a broken neighbour would break this plugin's
    // first load.
    expect(await importForeignCrmSettings(fakeApp({ [apertrailPath]: 'not json {' }))).toBeNull();
    expect(await importForeignCrmSettings(fakeApp({ [apertrailPath]: '"a string"' }))).toBeNull();
    expect(await importForeignCrmSettings(fakeApp({ [apertrailPath]: '[]' }))).toBeNull();
  });

  describe('from APERtrail', () => {
    it('adopts the CRM settings verbatim, since the key names already agree', async () => {
      const result = await importForeignCrmSettings(
        fakeApp({
          [apertrailPath]: JSON.stringify({
            rootFolder: '4 Resources',
            crmFolder: '4 Resources/CRM',
            personsFolder: '4 Resources/CRM/Personen',
            companiesFolder: '4 Resources/CRM/Firmen',
            personTypeValue: 'person',
            companyTypeValue: 'company',
            eligiblePersonTags: 'Familie',
          }),
        })
      );

      expect(result?.source).toBe('apertrail');
      expect(result?.settings.personsFolder).toBe('4 Resources/CRM/Personen');
      expect(result?.settings.eligiblePersonTags).toBe('Familie');
    });

    it('adopts nothing outside the CRM surface', async () => {
      // Adopting a folder changes where the plugin looks. Adopting a
      // behaviour toggle would change what it does, and nobody asked for that.
      const result = await importForeignCrmSettings(
        fakeApp({
          [apertrailPath]: JSON.stringify({
            personsFolder: 'CRM/People',
            sunTimesEnabled: false,
            showRibbonIcon: false,
            tripsFolder: 'Trips',
            favoriteProperty: 'lieblingsspeise',
          }),
        })
      );

      expect(Object.keys(result?.settings ?? {})).toEqual(['personsFolder']);

      const settings = mergeSettings(result?.settings);
      expect(settings.showRibbonIcons).toBe(true);
      expect(settings.favoriteProperty).toBe('favorite');
    });

    it('ignores a blank value rather than adopting it', async () => {
      // A blank folder is skipped by every reader, so adopting one would hide
      // the folder rather than configure it.
      const result = await importForeignCrmSettings(
        fakeApp({
          [apertrailPath]: JSON.stringify({ personsFolder: '   ', companiesFolder: 'CRM/Firmen' }),
        })
      );
      expect(result?.adopted).toEqual(['companiesFolder']);
    });

    it('yields nothing when the sibling is installed but configured no CRM', async () => {
      // "Anything" means at least one adopted key, not merely a readable file.
      // An install that never touched the CRM settings has nothing to hand
      // over, and saying so is what lets the next sibling, or CULItrail's own
      // defaults, have the vault.
      const result = await importForeignCrmSettings(
        fakeApp({ [apertrailPath]: JSON.stringify({ sunTimesEnabled: true }) })
      );
      expect(result).toBeNull();
    });
  });
});
