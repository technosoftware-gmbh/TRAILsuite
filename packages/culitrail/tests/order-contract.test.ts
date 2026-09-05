/**
 * CULItrail's half of the shared order contract.
 *
 * CULItrail writes order notes and NODAtrail reads four facts off them to price
 * a card statement. This plugin is the author, so these values are its answers
 * and the other side copies them. That makes a rename here the change most
 * likely to break the other plugin, and the least likely to look like it.
 *
 * The failure mode is not an error. A folder that no longer matches gives an
 * empty list; a property that no longer matches gives an order with no price,
 * which reaches somebody as a wrong figure in a ledger rather than as anything
 * red. The values themselves are asserted in trail-core's own suite. This
 * asserts only that this plugin still agrees with them.
 */
import { describe, expect, it } from 'vitest';
import {
  ORDER_CONTRACT,
  orderContractMismatches,
  describeOrderContractMismatches,
} from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS, getLocalizedDefaults } from '../src/settings/defaults';
import { mergeSettings } from '../src/settings/validate';

describe('the shared order contract', () => {
  it('is what DEFAULT_SETTINGS ships', () => {
    const mismatches = orderContractMismatches(DEFAULT_SETTINGS);
    expect(describeOrderContractMismatches(mismatches)).toBe('');
  });

  it('survives mergeSettings given nothing', () => {
    // The defaults object is one thing; what a fresh install persists into
    // data.json is another, and it is the persisted values the other plugin
    // reads off disk.
    const mismatches = orderContractMismatches(mergeSettings(null));
    expect(describeOrderContractMismatches(mismatches)).toBe('');
  });

  it('derives the same orders folder a fresh install actually persists', () => {
    // DEFAULT_SETTINGS.ordersFolder is not what reaches data.json.
    // mergeSettings() seeds the folder tree from getLocalizedDefaults(), so
    // the orders folder has a second source, and it is that one NODAtrail
    // reads off disk. Both have to agree with the contract, or the literal in
    // DEFAULT_SETTINGS is a value nothing ships and the contract describes a
    // folder no vault has.
    //
    // Only the English derivation is asserted. A German vault resolves a
    // German name here on purpose, and the sibling adopts whatever was
    // persisted rather than assuming this one.
    expect(getLocalizedDefaults().ordersFolder).toBe(ORDER_CONTRACT.ordersFolder);
  });

  it('still lets a vault rename any of it', () => {
    // The contract fixes what ships, not what a vault is allowed to call
    // things. A configured value has to win.
    const settings = mergeSettings({ orderPriceProperty: 'betrag' });
    expect(settings.orderPriceProperty).toBe('betrag');
    expect(ORDER_CONTRACT.orderPriceProperty).toBe('price');
  });
});
