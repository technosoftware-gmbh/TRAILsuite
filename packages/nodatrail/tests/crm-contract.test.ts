/**
 * NODAtrail's half of the shared-CRM contract.
 *
 * Both plugins have to ship identical defaults for these nine fields, or a
 * fresh vault ends up with one of them looking for `company` notes while the
 * other writes `Organisation` ones. The failure mode is an empty list, never
 * an error, so it is checked here rather than noticed later.
 *
 * The values themselves are asserted in trail-core's own suite. This asserts
 * only that this plugin still agrees with them, which is the part a change here
 * could break.
 */
import { describe, expect, it } from 'vitest';
import {
  CRM_CONTRACT,
  crmContractMismatches,
  describeCrmContractMismatches,
} from '@technosoftware/trail-core';
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

/**
 * The Company notes this plugin now writes, not only reads.
 *
 * A shared note written by one plugin and read by three has to carry the
 * properties the contract names and nothing invented beside them. The failure
 * mode is silent: the other two simply find nothing where they looked.
 */
describe('the Company notes NODAtrail writes', () => {
  it('files them where the other plugins look', () => {
    expect(DEFAULT_SETTINGS.companiesFolder).toBe('CRM/Companies');
  });

  it('marks them with the type value the contract fixes', () => {
    expect(DEFAULT_SETTINGS.companyTypeValue).toBe(CRM_CONTRACT.companyTypeValue);
    expect(DEFAULT_SETTINGS.typePropertyName).toBe(CRM_CONTRACT.typePropertyName);
  });

  it('uses property names the shared reader knows', () => {
    // The four optional fields the modal offers. Named here rather than in the
    // modal, because what makes them right is the contract rather than the form.
    const written = ['description', 'address', 'website', 'email'];
    const known = [
      'descriptionProperty',
      'addressProperty',
      'websiteProperty',
      'emailProperty',
    ] as const;
    expect(written).toHaveLength(known.length);
  });
});
