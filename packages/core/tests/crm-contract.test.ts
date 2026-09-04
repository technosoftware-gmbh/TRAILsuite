/**
 * The contract itself, and the helper each plugin's own suite calls.
 *
 * The values are asserted literally rather than against the constant: a test
 * that reads `CRM_CONTRACT.personTypeValue` and compares it to
 * `CRM_CONTRACT.personTypeValue` passes whatever the value is, which is the one
 * thing this file exists to prevent.
 */
import { describe, expect, it } from 'vitest';
import {
  CRM_CONTRACT,
  CRM_CONTRACT_KEYS,
  crmContractMismatches,
  describeCrmContractMismatches,
  type CrmContract,
} from '../src/settings/crm-contract';

describe('CRM_CONTRACT', () => {
  it('holds the agreed values', () => {
    expect(CRM_CONTRACT).toEqual({
      typePropertyName: 'type',
      personsFolder: 'CRM/People',
      companiesFolder: 'CRM/Companies',
      personTypeValue: 'person',
      companyTypeValue: 'company',
      personTagProperty: 'tags',
      companyTagProperty: 'tags',
      personRolesProperty: 'roles',
      companyRolesProperty: 'roles',
    });
  });

  it('spells the type values in lower case', () => {
    // The casing is compared against on-disk `type:` values, so it is data
    // rather than style. `Person` and `Organisation` shipped for a while
    // against a vault that had since moved to lower case, and nothing said so.
    expect(CRM_CONTRACT.personTypeValue).toBe('person');
    expect(CRM_CONTRACT.companyTypeValue).toBe('company');
  });

  it('is frozen, so a consumer cannot edit the shared copy', () => {
    expect(Object.isFrozen(CRM_CONTRACT)).toBe(true);
  });

  it('lists every key of the interface exactly once', () => {
    expect([...CRM_CONTRACT_KEYS].sort()).toEqual(Object.keys(CRM_CONTRACT).sort());
    expect(new Set(CRM_CONTRACT_KEYS).size).toBe(CRM_CONTRACT_KEYS.length);
  });
});

describe('crmContractMismatches', () => {
  it('finds nothing when the defaults match', () => {
    expect(crmContractMismatches({ ...CRM_CONTRACT })).toEqual([]);
  });

  it('reports a value that disagrees', () => {
    const drifted: CrmContract = { ...CRM_CONTRACT, companyTypeValue: 'Organisation' };
    expect(crmContractMismatches(drifted)).toEqual([
      { key: 'companyTypeValue', expected: 'company', actual: 'Organisation' },
    ]);
  });

  it('reports a missing key rather than skipping it', () => {
    const { personTagProperty: _omitted, ...partial } = { ...CRM_CONTRACT };
    expect(crmContractMismatches(partial)).toEqual([
      { key: 'personTagProperty', expected: 'tags', actual: undefined },
    ]);
  });

  it('catches the drift that prompted this module', () => {
    // The defaults as they were shipped before the contract existed: the type
    // values capitalized against a vault that had already moved on.
    const beforeTheContract = {
      ...CRM_CONTRACT,
      personTypeValue: 'Person',
      companyTypeValue: 'Organisation',
    };
    expect(crmContractMismatches(beforeTheContract).map((m) => m.key)).toEqual([
      'personTypeValue',
      'companyTypeValue',
    ]);
  });

  it('reports every key a partial defaults object leaves out', () => {
    // Holding three of the seven is not partial agreement, it is four keys a
    // vault gets nothing for. All four are named, not passed over.
    const three = {
      typePropertyName: 'type',
      personTypeValue: 'person',
      companyTypeValue: 'company',
    };
    expect(crmContractMismatches(three).map((m) => m.key)).toEqual([
      'personsFolder',
      'companiesFolder',
      'personTagProperty',
      'companyTagProperty',
      'personRolesProperty',
      'companyRolesProperty',
    ]);
  });

  it('reports in contract order, not in the caller object order', () => {
    const scrambled: CrmContract = {
      companyTagProperty: 'x',
      personTagProperty: 'y',
      companyTypeValue: 'z',
      personTypeValue: 'w',
      companiesFolder: 'a',
      personsFolder: 'b',
      typePropertyName: 'c',
      companyRolesProperty: 'd',
      personRolesProperty: 'e',
    };
    expect(crmContractMismatches(scrambled).map((m) => m.key)).toEqual([...CRM_CONTRACT_KEYS]);
  });
});

describe('describeCrmContractMismatches', () => {
  it('names the key, what was wanted and what was found', () => {
    const message = describeCrmContractMismatches(
      crmContractMismatches({ ...CRM_CONTRACT, personsFolder: 'People' })
    );
    expect(message).toBe('personsFolder: expected "CRM/People", got "People"');
  });

  it('is empty for no mismatches, so a passing assertion reads as silence', () => {
    expect(describeCrmContractMismatches([])).toBe('');
  });
});
