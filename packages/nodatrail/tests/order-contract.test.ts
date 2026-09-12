/**
 * NODAtrail's half of the shared order contract.
 *
 * NODAtrail does not write orders. It reads CULItrail's, so these six defaults
 * are a copy of another plugin's answers, kept only so a vault with no
 * CULItrail installed still looks in a sensible place. A copy that drifts is
 * worse than no copy at all: `readOrders` finds the notes and reads every one
 * of them as unpriced, and the statement matching then quietly stops finding
 * anything.
 *
 * The values are asserted in trail-core's own suite. This asserts only that
 * this plugin still agrees with them.
 */
import { describe, expect, it } from 'vitest';
import {
  ORDER_CONTRACT,
  orderContractMismatches,
  describeOrderContractMismatches,
} from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { mergeSettings } from '../src/settings/validate';

describe('the shared order contract', () => {
  it('is what DEFAULT_SETTINGS ships', () => {
    const mismatches = orderContractMismatches(DEFAULT_SETTINGS);
    expect(describeOrderContractMismatches(mismatches)).toBe('');
  });

  it('survives mergeSettings given nothing', () => {
    const mismatches = orderContractMismatches(mergeSettings(null));
    expect(describeOrderContractMismatches(mismatches)).toBe('');
  });

  it('still lets a vault rename any of it', () => {
    const settings = mergeSettings({ ordersFolder: 'Essen/Bestellungen' });
    expect(settings.ordersFolder).toBe('Essen/Bestellungen');
    expect(ORDER_CONTRACT.ordersFolder).toBe('Eating/Orders');
  });

  it('reads an order note through the property names the contract fixes', () => {
    // readOrders() takes these four off the frontmatter. Named here as well as
    // in the reader because what makes them right is the agreement with the
    // other plugin, not the shape of this function.
    expect(DEFAULT_SETTINGS.orderCompanyProperty).toBe(ORDER_CONTRACT.orderCompanyProperty);
    expect(DEFAULT_SETTINGS.orderDateProperty).toBe(ORDER_CONTRACT.orderDateProperty);
    expect(DEFAULT_SETTINGS.orderPriceProperty).toBe(ORDER_CONTRACT.orderPriceProperty);
    expect(DEFAULT_SETTINGS.orderPriceCurrencyProperty).toBe(
      ORDER_CONTRACT.orderPriceCurrencyProperty
    );
  });
});
