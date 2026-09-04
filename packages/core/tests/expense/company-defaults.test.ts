/**
 * The company that already knows where its invoices go.
 *
 * A household buys from the same few dozen places and answers "which account,
 * which category" the same way nearly every time. Storing the answer on the
 * company note removes the largest remaining piece of typing in a month's
 * entry, and removes it from the place that produced disagreements: an insurer
 * booked to 4005 eleven times and 4036 once is not a fact about the twelfth
 * invoice, it is a slip.
 *
 * Digitec is why this is a default and not a rule -- mostly sundries,
 * occasionally a camera -- so the two things pinned hardest below are that the
 * form always wins afterwards, and that a company never learns from a field
 * somebody cleared.
 */
import { describe, expect, it } from 'vitest';
import {
  companyDefaultsToLearn,
  hasCompanyDefaults,
  inheritFromCompany,
  parseCompanyDefaults,
  type CompanyDefaultProperties,
} from '../../src/index.js';

const P: CompanyDefaultProperties = { accountProperty: 'account', categoryProperty: 'category' };
const NOTHING = { account: null, category: null };

describe('reading a company note', () => {
  it('takes the account and the category', () => {
    expect(parseCompanyDefaults({ account: 4005, category: 'insurance' }, P)).toEqual({
      account: 4005,
      category: 'insurance',
    });
  });

  it('reads an account written as text, which is how a property editor leaves it', () => {
    expect(parseCompanyDefaults({ account: '4031' }, P).account).toBe(4031);
  });

  it('says nothing about a company nobody has classified', () => {
    expect(parseCompanyDefaults({}, P)).toEqual(NOTHING);
    expect(hasCompanyDefaults(NOTHING)).toBe(false);
  });

  it('counts a company with only one of the two as having something to say', () => {
    expect(hasCompanyDefaults({ account: 4036, category: null })).toBe(true);
    expect(hasCompanyDefaults({ account: null, category: 'other' })).toBe(true);
  });

  it('reads the names the vault uses, not these ones', () => {
    const german = { accountProperty: 'konto', categoryProperty: 'kategorie' };
    expect(parseCompanyDefaults({ konto: 4000, kategorie: 'haushalt' }, german)).toEqual({
      account: 4000,
      category: 'haushalt',
    });
  });
});

describe('filling a form from the company it names', () => {
  const AQUILANA = { account: 4031, category: 'health' };

  it('fills an empty form', () => {
    expect(inheritFromCompany(NOTHING, AQUILANA)).toEqual(AQUILANA);
  });

  it('overwrites what was there, because somebody just chose this company', () => {
    expect(inheritFromCompany({ account: 4036, category: 'other' }, AQUILANA)).toEqual(AQUILANA);
  });

  it('leaves alone what the company says nothing about', () => {
    const half = { account: 4039, category: null };
    expect(inheritFromCompany({ account: 4000, category: 'household' }, half)).toEqual({
      account: 4039,
      category: 'household',
    });
  });

  it('empties nothing, whatever the company is missing', () => {
    const typed = { account: 4000, category: 'household' };
    expect(inheritFromCompany(typed, NOTHING)).toEqual(typed);
  });

  it('keeps everything else on the form untouched', () => {
    const form = { ...NOTHING, amount: 92.15, reference: 'X-1' };
    expect(inheritFromCompany(form, AQUILANA)).toEqual({
      ...AQUILANA,
      amount: 92.15,
      reference: 'X-1',
    });
  });

  it('does not mutate what it was given', () => {
    const form = { account: 4036, category: 'other' };
    inheritFromCompany(form, AQUILANA);
    expect(form).toEqual({ account: 4036, category: 'other' });
  });
});

describe('what a company would have to learn', () => {
  it('is nothing when the form already agrees', () => {
    const same = { account: 4031, category: 'health' };
    expect(companyDefaultsToLearn(same, same)).toBeNull();
  });

  it("is the form's answer when the company has none", () => {
    expect(companyDefaultsToLearn(NOTHING, { account: 4036, category: 'other' })).toEqual({
      account: 4036,
      category: 'other',
    });
  });

  it('is the correction when the form disagrees', () => {
    // Digitec, on the month somebody buys a camera and decides that is the new
    // usual. Offering it is the point; whether to take it is the person's.
    expect(
      companyDefaultsToLearn(
        { account: 4036, category: 'other' },
        { account: 4039, category: 'other' }
      )
    ).toEqual({ account: 4039, category: 'other' });
  });

  it('never learns from a field somebody cleared', () => {
    // A blank on one invoice says nothing about the next one, so the company
    // keeps what it had and there is nothing left to offer.
    expect(companyDefaultsToLearn({ account: 4031, category: 'health' }, NOTHING)).toBeNull();
  });

  it('learns one field while the other stays cleared', () => {
    expect(
      companyDefaultsToLearn(
        { account: 4031, category: null },
        { account: null, category: 'health' }
      )
    ).toEqual({ account: 4031, category: 'health' });
  });
});
