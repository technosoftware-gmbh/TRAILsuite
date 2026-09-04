/**
 * A field added to the adopted list after the vault was set up.
 *
 * `adoptSiblingSettings` runs on a fresh install only, which is right for
 * everything it covers and leaves one gap: a field added to the list later
 * reaches nobody who is already running. Every existing vault would carry a
 * folder path pointing at nothing, and the only cure would be somebody noticing
 * a settings row they have no reason to look at.
 *
 * `adoptOrderSettings` closes it for the six order fields, on a rule narrow
 * enough to be safe: adopt only while the value is exactly what shipped. That
 * cannot overwrite a choice, because no choice has been made. It is safe for
 * these and would not be for the CRM fields, and the difference is what the
 * default means: `Eating/Orders` is a guess about another plugin's folder,
 * whereas `CRM/People` is a real answer somebody may have deliberately kept.
 */
import { describe, expect, it, vi } from 'vitest';
import { adoptOrderSettings } from '../src/settings/foreign-settings-import';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import type { NODAtrailSettings } from '../src/settings/types';

/**
 * The vault's configuration folder, which is not necessarily `.obsidian`.
 *
 * Built from a name rather than written out, so the fixture exercises the same
 * `configDir` the code reads instead of quietly agreeing with a default that a
 * vault is free to change.
 */
const CONFIG_DIR = 'my-config';
const pluginData = (id: string): string => `${CONFIG_DIR}/plugins/${id}/data.json`;

/** An app whose only job is to hand back a sibling's `data.json`. */
function appWith(files: Record<string, unknown>) {
  return {
    vault: {
      configDir: CONFIG_DIR,
      adapter: {
        exists: vi.fn((path: string) => Promise.resolve(path in files)),
        read: vi.fn((path: string) => Promise.resolve(JSON.stringify(files[path]))),
      },
    },
  } as never;
}

const CULI = pluginData('culitrail');
const APER = pluginData('apertrail');

const SIBLING = {
  ordersFolder: 'Essen/Bestellungen',
  orderTypeValue: 'order',
  orderCompanyProperty: 'company',
  orderDateProperty: 'orderDate',
  orderPriceProperty: 'price',
  orderPriceCurrencyProperty: 'priceCurrency',
};

const fresh = (): NODAtrailSettings => ({ ...DEFAULT_SETTINGS });

describe('learning where a sibling keeps its orders', () => {
  it('takes the folder from the sibling when nothing has been chosen', async () => {
    const settings = fresh();
    const changed = await adoptOrderSettings(
      appWith({ [CULI]: SIBLING }),
      settings,
      DEFAULT_SETTINGS
    );
    expect(changed).toBe(true);
    expect(settings.ordersFolder).toBe('Essen/Bestellungen');
  });

  it('leaves a folder somebody chose alone', async () => {
    // Field by field, not all-or-nothing: the folder was answered and the
    // property names were not, so only the names are taken.
    const settings = { ...fresh(), ordersFolder: 'Meine Bestellungen' };
    await adoptOrderSettings(appWith({ [CULI]: SIBLING }), settings, DEFAULT_SETTINGS);
    expect(settings.ordersFolder).toBe('Meine Bestellungen');
  });

  it('reports no change when there is nothing left to learn', async () => {
    // Already holding exactly what the sibling would give. Reporting a change
    // here would cost a settings save on every single load.
    const settings = { ...fresh(), ...SIBLING };
    const changed = await adoptOrderSettings(
      appWith({ [CULI]: SIBLING }),
      settings,
      DEFAULT_SETTINGS
    );
    expect(changed).toBe(false);
  });

  it('leaves a folder somebody cleared alone, which is how the feature is switched off', async () => {
    // Blank is a decision: it says "do not read orders". Refilling it would
    // turn a feature back on that somebody turned off.
    const settings = { ...fresh(), ordersFolder: '' };
    await adoptOrderSettings(appWith({ [CULI]: SIBLING }), settings, DEFAULT_SETTINGS);
    expect(settings.ordersFolder).toBe('');
  });

  it('changes nothing when no sibling is installed', async () => {
    const settings = fresh();
    const changed = await adoptOrderSettings(appWith({}), settings, DEFAULT_SETTINGS);
    expect(changed).toBe(false);
    expect(settings.ordersFolder).toBe(DEFAULT_SETTINGS.ordersFolder);
  });

  it('ignores a sibling that states the field blank', async () => {
    const settings = fresh();
    await adoptOrderSettings(
      appWith({ [CULI]: { ordersFolder: '   ' } }),
      settings,
      DEFAULT_SETTINGS
    );
    expect(settings.ordersFolder).toBe(DEFAULT_SETTINGS.ordersFolder);
  });

  it('takes each field from the first sibling that states it', async () => {
    // APERtrail has no orders, so it answers none of these and CULItrail does.
    const settings = fresh();
    await adoptOrderSettings(
      appWith({ [APER]: { crmFolder: 'CRM' }, [CULI]: SIBLING }),
      settings,
      DEFAULT_SETTINGS
    );
    expect(settings.ordersFolder).toBe('Essen/Bestellungen');
    expect(settings.orderPriceProperty).toBe('price');
  });

  it('adopts the property names too, not only the folder', async () => {
    // A folder without the names reads every order as unpriced, which is worse
    // than not looking at all.
    const settings = fresh();
    await adoptOrderSettings(
      appWith({ [CULI]: { ...SIBLING, orderPriceProperty: 'gesamt' } }),
      settings,
      DEFAULT_SETTINGS
    );
    expect(settings.orderPriceProperty).toBe('gesamt');
  });

  it('touches nothing outside the six order fields', async () => {
    const settings = fresh();
    await adoptOrderSettings(
      appWith({
        [CULI]: { ...SIBLING, personsFolder: 'Somewhere else', typePropertyName: 'kind' },
      }),
      settings,
      DEFAULT_SETTINGS
    );
    expect(settings.personsFolder).toBe(DEFAULT_SETTINGS.personsFolder);
    expect(settings.typePropertyName).toBe(DEFAULT_SETTINGS.typePropertyName);
  });
});
