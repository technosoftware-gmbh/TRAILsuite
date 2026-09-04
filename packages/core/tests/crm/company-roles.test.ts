/**
 * What a company is, and the answer that must be given when nobody has said.
 *
 * A vault accumulates every company anybody has ever paid, and a meal-supplier
 * dropdown over two hundred of them is a dropdown nobody can use. `roles` is
 * how a company says which lists it belongs in.
 *
 * The rule worth a test is which empty case carries the migration safety. It is
 * the empty *setting*, not the empty roles list: a plugin's filter ships blank
 * and admits everyone, and narrowing starts when somebody fills it in. The
 * first version put it on the roles list instead, and that made the filter do
 * nothing in exactly the state a vault is in while being classified.
 */
import { describe, expect, it } from 'vitest';
import { companyHasRole, parseCrmNote, type CrmPropertyNames } from '../../src/crm/note';

const P: CrmPropertyNames = {
  typePropertyName: 'type',
  personTypeValue: 'person',
  companyTypeValue: 'company',
  personTagProperty: 'tags',
  companyTagProperty: 'tags',
  personRolesProperty: 'roles',
  companyRolesProperty: 'roles',
};

describe('reading what a person is', () => {
  it("reads a person's roles from the person key", () => {
    // Persons had no roles at all until the second use case turned up: a
    // person can send you an invoice as much as a company can.
    expect(parseCrmNote({ roles: ['vendor'] }, P, 'person').roles).toEqual(['vendor']);
  });

  it('reads the two kinds from their own keys', () => {
    const split: CrmPropertyNames = { ...P, personRolesProperty: 'personRoles' };
    const frontmatter = { roles: ['meals'], personRoles: ['customer'] };
    expect(parseCrmNote(frontmatter, split, 'person').roles).toEqual(['customer']);
    expect(parseCrmNote(frontmatter, split, 'company').roles).toEqual(['meals']);
  });
});

describe('reading what a company is', () => {
  it('takes a list', () => {
    expect(parseCrmNote({ roles: ['meals', 'restaurant'] }, P, 'company').roles).toEqual([
      'meals',
      'restaurant',
    ]);
  });

  it('takes the shapes a hand-edited note uses', () => {
    // A bare value and a comma-separated string are both how somebody writes a
    // short list by hand, and both occur in a real vault.
    expect(parseCrmNote({ roles: 'meals' }, P, 'company').roles).toEqual(['meals']);
    expect(parseCrmNote({ roles: 'meals, hotel' }, P, 'company').roles).toEqual(['meals', 'hotel']);
  });

  it('answers nothing for a company that has not said', () => {
    expect(parseCrmNote({}, P, 'company').roles).toEqual([]);
  });

  it('answers nothing when the vault has not named the property', () => {
    const unnamed: CrmPropertyNames = { ...P, companyRolesProperty: undefined };
    expect(parseCrmNote({ roles: ['meals'] }, unnamed, 'company').roles).toEqual([]);
  });
});

describe('whether a company belongs in a list', () => {
  it('includes a company that names the role', () => {
    expect(companyHasRole(['meals', 'hotel'], 'meals')).toBe(true);
  });

  it('excludes a company that names other roles', () => {
    expect(companyHasRole(['hotel'], 'meals')).toBe(false);
  });

  it('excludes a company that names none, once a role is asked for', () => {
    // The rule that changed. Treating silence as eligible made the filter
    // useless in the state a vault is in while being classified: one company
    // answered, forty-three silent, and a list that still showed all
    // forty-four. The migration safety is the setting shipping empty instead,
    // which is visible and can be turned off.
    expect(companyHasRole([], 'meals')).toBe(false);
  });

  it('does not care how a role is capitalised', () => {
    expect(companyHasRole(['Meals'], 'meals')).toBe(true);
    expect(companyHasRole(['meals'], 'MEALS')).toBe(true);
  });

  it('includes everything when no role is asked for', () => {
    // The unconfigured filter, which is where the migration safety lives now:
    // an empty setting must never be a filter that hides everything.
    expect(companyHasRole(['hotel'], '')).toBe(true);
    expect(companyHasRole(['hotel'], '   ')).toBe(true);
    expect(companyHasRole([], '')).toBe(true);
  });
});
