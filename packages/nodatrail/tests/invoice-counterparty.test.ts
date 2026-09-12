/**
 * Who an invoice may name, and which of them the form offers.
 *
 * Companies and persons in one list under one property. A bill's `company`
 * holds a wikilink and nothing has ever checked which folder it resolves into,
 * so a person who invoices the household needs no new property and no
 * migration -- the picker was the only thing that would not offer one, and one
 * bill in the vault had been pointing at a person note for three days.
 *
 * A shared title resolves to the company, and the two places that resolve one
 * have to agree: the picker and the account-and-category lookup. If they
 * disagreed, a form would read the defaults off one note and write the
 * corrected ones back to the other.
 *
 * The rest of this file is the narrowing to vendors and to customers.
 *
 * The feature is two settings and a filter, and almost everything that could go
 * wrong with it goes wrong by emptying a dropdown rather than by throwing.
 *
 * Three rules carry that risk.
 *
 * **Blank offers everybody.** Both settings ship empty and `companyHasRole`
 * treats an empty requirement as no requirement, so a vault where nobody has
 * been classified -- which is every vault the day this ships, and this one has
 * roles on one company out of forty-four -- sees no change at all. Shipping a
 * non-blank default would be shipping two pickers with nothing in them.
 *
 * **A company created from a narrowed form carries the role.** The plus button
 * beside the dropdown exists because a vendor missing from the vault is the
 * commonest thing a first month of invoices meets. If the note it wrote did not
 * carry the role the form is filtering on, the filter would reject what it had
 * just invited somebody to create, and it would be gone by the next time the
 * form opened.
 *
 * **Changing direction rechecks the chosen company.** An Obsidian dropdown
 * holding a value with no matching option displays the *first* option instead,
 * so a company left over from the other direction would be invisible on screen
 * and still be what the note got. Checked rather than cleared, because a
 * company carrying both roles is valid on both sides.
 *
 * The first is a real test. The other two are source tests over the form.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { companyHasRole } from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const form = readFileSync(
  join(__dirname, '..', 'src', 'ui', 'modals', 'new-finance-modals.ts'),
  'utf8'
);
const board = readFileSync(join(__dirname, '..', 'src', 'crm', 'read-crm-board.ts'), 'utf8');
const defaults = readFileSync(join(__dirname, '..', 'src', 'crm', 'company-defaults.ts'), 'utf8');
const companyModal = readFileSync(
  join(__dirname, '..', 'src', 'crm', 'new-company-modal.ts'),
  'utf8'
);

describe('the two role settings', () => {
  it('ship blank, so an unclassified vault is offered every company', () => {
    expect(DEFAULT_SETTINGS.billVendorRole).toBe('');
    expect(DEFAULT_SETTINGS.billCustomerRole).toBe('');
  });

  it('are blank in the sense the filter reads as "everyone"', () => {
    // The two halves of the rule, joined. A default of '' is only safe because
    // this is what '' means.
    expect(companyHasRole([], DEFAULT_SETTINGS.billVendorRole)).toBe(true);
    expect(companyHasRole(['meals'], DEFAULT_SETTINGS.billCustomerRole)).toBe(true);
    expect(companyHasRole([], 'vendor')).toBe(false);
  });
});

describe('the invoice form', () => {
  it('asks for the vendor role one way and the customer role the other', () => {
    expect(form).toContain(
      "return this.direction === 'outgoing' ? settings.billCustomerRole : settings.billVendorRole;"
    );
  });

  it('narrows the list through the core filter rather than a second rule', () => {
    expect(form).toContain('.filter((record) => companyHasRole(record.roles, role))');
  });

  it('offers persons on the same terms as companies', () => {
    // One list under one property. A person who invoices the household needs
    // no new property: `company` has always held a wikilink nothing checks the
    // folder of, and the picker was the only thing that would not offer one.
    expect(form).toContain('readCrmCounterparties(app, settings)');
    expect(board).toContain(
      "return [...read(app, settings, 'company'), ...read(app, settings, 'person')];"
    );
  });

  it('resolves a shared title to the company, in both places that resolve one', () => {
    // The picker's order and the defaults lookup's order have to agree, or a
    // form reads the account off one note and writes the corrected one back to
    // the other.
    const order = board.indexOf("read(app, settings, 'company')");
    expect(order).toBeLessThan(board.indexOf("read(app, settings, 'person')"));
    const folders = defaults.slice(defaults.indexOf('const folders'));
    expect(folders.indexOf('companiesFolder')).toBeLessThan(folders.indexOf('personsFolder'));
  });

  it('still matches payment providers among companies only', () => {
    // That list is what the statement importer matches a row's text against,
    // and a match there ends in a posting. Klarna is not a person.
    const fn = defaults.slice(defaults.indexOf('export function paymentProviderCompanies'));
    expect(fn).toContain('folders: [settings.companiesFolder]');
    expect(fn).not.toContain('personsFolder');
  });

  it('keeps offering a company it has just created', () => {
    // Both the cache lag and the role filter are skipped for these, and the
    // seeding below is what makes the second of those honest.
    expect(form).toMatch(/for \(const title of made\) titles\.add\(title\);/);
  });

  it('seeds the role it filters on into a company created from the form', () => {
    const call = form.slice(form.indexOf('new NewCompanyModal('));
    expect(call.slice(0, call.indexOf('.open()'))).toContain('this.companyRole()');
    expect(companyModal).toContain('initialRoles = ');
    expect(companyModal).toContain('this.roles = initialRoles;');
  });

  it('drops a chosen company the new direction no longer offers', () => {
    expect(form).toContain(
      'if (this.companyTitle && !this.offeredCompanyTitles().includes(this.companyTitle)) {'
    );
    expect(form).toContain("this.companyTitle = '';");
  });

  it('leaves the forms with no direction offering everyone', () => {
    // The base hook. A purchase or a hand posting names whoever it names, and
    // this is what says so.
    expect(form).toMatch(/protected companyRole\(\): string \{\s*return '';\s*\}/);
  });
});
