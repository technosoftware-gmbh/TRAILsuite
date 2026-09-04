/**
 * APERtrail's half of the shared-CRM contract.
 *
 * Both plugins have to ship identical defaults for these seven fields, or a
 * fresh vault ends up with one of them looking for `company` notes while the
 * other writes `Organisation` ones. The failure mode is an empty list, never
 * an error, so it is checked here rather than noticed later.
 *
 * The values themselves are asserted in trail-core's own suite. This asserts
 * only that this plugin still agrees with them, which is the part a change here
 * could break.
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
    // The defaults object is one thing; what a fresh install actually persists
    // is another, and it is the persisted values the other plugin reads.
    const mismatches = crmContractMismatches(mergeSettings(null));
    expect(describeCrmContractMismatches(mismatches)).toBe('');
  });

  it('still lets a vault rename any of it', () => {
    // The contract is about defaults, not about locking a vault out of its own
    // spelling. A configured value has to win.
    const settings = mergeSettings({ personTypeValue: 'Kontakt' });
    expect(settings.personTypeValue).toBe('Kontakt');
    expect(CRM_CONTRACT.personTypeValue).toBe('person');
  });
});
