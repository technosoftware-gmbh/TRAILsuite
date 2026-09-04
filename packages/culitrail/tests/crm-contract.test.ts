/**
 * CULItrail's half of the shared-CRM contract.
 *
 * Both plugins have to ship identical defaults for these nine fields, or a
 * fresh vault ends up with one of them looking for `company` notes while the
 * other writes `Organisation` ones. The failure mode is an empty list, never
 * an error, so it is checked here rather than noticed later.
 *
 * The values themselves are asserted in trail-core's own suite. This asserts
 * only that this plugin still agrees with them.
 */
import { describe, expect, it } from 'vitest';
import { CRM_CONTRACT, crmContractMismatches, describeCrmContractMismatches } from 'trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { mergeSettings } from '../src/settings/validate';

describe('the shared CRM contract', () => {
  it('is what DEFAULT_SETTINGS ships', () => {
    const mismatches = crmContractMismatches(DEFAULT_SETTINGS);
    expect(describeCrmContractMismatches(mismatches)).toBe('');
  });

  it('survives mergeSettings given nothing', () => {
    const mismatches = crmContractMismatches(mergeSettings(null));
    expect(describeCrmContractMismatches(mismatches)).toBe('');
  });

  it('still lets a vault rename any of it', () => {
    const settings = mergeSettings({ companyTypeValue: 'Lieferant' });
    expect(settings.companyTypeValue).toBe('Lieferant');
    expect(CRM_CONTRACT.companyTypeValue).toBe('company');
  });
});
