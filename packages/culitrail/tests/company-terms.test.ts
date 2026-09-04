/**
 * What a company charges, read off its note.
 *
 * The interesting half is the discount ladder, which is typed by hand into
 * frontmatter and therefore arrives in whatever shape and order somebody felt
 * like. Everything else is one property in and one value out.
 *
 * The unit-agnostic promise is asserted here too: nothing this module returns
 * knows it is counting meals. That is what lets the file move to `trail-core`
 * unchanged the day APERtrail wants the same block for hotels.
 */
import { describe, expect, it } from 'vitest';
import {
  discountFor,
  emptyCompanyTerms,
  readCompanyTerms,
  readDiscountTiers,
  shippingFor,
  type CompanyTermsProperties,
} from '../src/crm/company-terms';
import { crmPropertyNames } from '../src/crm/crm-note';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const PROPERTIES: CompanyTermsProperties = crmPropertyNames(DEFAULT_SETTINGS).companyTerms;

describe('reading a company note', () => {
  it('reads every term the shipped property names point at', () => {
    const terms = readCompanyTerms(
      {
        currency: 'CHF',
        paymentMethod: 'Invoice',
        invoiceTiming: 'At order',
        shippingFee: 9.9,
        freeShippingFrom: 12,
        discountTable: [
          { from: 6, percent: 5 },
          { from: 12, percent: 10 },
        ],
        lines: ['Alltag', 'Sport', 'Weightloss'],
      },
      PROPERTIES
    );

    expect(terms).toEqual({
      currency: 'CHF',
      paymentMethod: 'Invoice',
      invoiceTiming: 'At order',
      shippingFee: 9.9,
      freeShippingFrom: 12,
      discountTiers: [
        { from: 6, percent: 5 },
        { from: 12, percent: 10 },
      ],
      lines: ['Alltag', 'Sport', 'Weightloss'],
    });
  });

  it('gives the empty terms for a note that states nothing', () => {
    expect(readCompanyTerms({}, PROPERTIES)).toEqual(emptyCompanyTerms());
  });

  it('reads the property names the settings name, not the shipped ones', () => {
    const german: CompanyTermsProperties = { ...PROPERTIES, currency: 'waehrung' };
    expect(readCompanyTerms({ waehrung: 'EUR', currency: 'CHF' }, german).currency).toBe('EUR');
  });
});

describe('the discount ladder', () => {
  it('takes a row written as a mapping', () => {
    expect(readDiscountTiers([{ from: 12, percent: 10 }])).toEqual([{ from: 12, percent: 10 }]);
  });

  it('takes a row written as one line, which is how six of them get typed', () => {
    expect(readDiscountTiers(['6: 5', '12: 10%', '24 = 15'])).toEqual([
      { from: 6, percent: 5 },
      { from: 12, percent: 10 },
      { from: 24, percent: 15 },
    ]);
  });

  it('sorts, because a hand-written table is in the order it was typed', () => {
    expect(readDiscountTiers(['12: 10', '6: 5']).map((tier) => tier.from)).toEqual([6, 12]);
  });

  it('keeps the later of two rows at the same count', () => {
    // A correction somebody made without deleting the line above it.
    expect(readDiscountTiers(['12: 10', '12: 15'])).toEqual([{ from: 12, percent: 15 }]);
  });

  it('drops a row that yields no numbers rather than defaulting it', () => {
    // A rung at zero would take the discount off every order, which is the one
    // failure a silent default would cause and nothing would explain.
    expect(readDiscountTiers(['nonsense', {}, null, { from: 6 }])).toEqual([]);
  });

  it('accepts a single row that is not in a list', () => {
    expect(readDiscountTiers({ from: 6, percent: 5 })).toEqual([{ from: 6, percent: 5 }]);
  });
});

describe('what a count is worth', () => {
  const tiers = readDiscountTiers(['6: 5', '12: 10', '24: 15']);

  it('takes the highest rung at or below the count', () => {
    expect(discountFor(tiers, 0)).toBe(0);
    expect(discountFor(tiers, 5)).toBe(0);
    expect(discountFor(tiers, 6)).toBe(5);
    expect(discountFor(tiers, 11)).toBe(5);
    expect(discountFor(tiers, 12)).toBe(10);
    expect(discountFor(tiers, 100)).toBe(15);
  });

  it('is zero rather than null with no ladder at all', () => {
    expect(discountFor([], 50)).toBe(0);
  });
});

describe('what shipping costs', () => {
  const terms = { ...emptyCompanyTerms(), shippingFee: 9.9, freeShippingFrom: 12 };

  it('charges the fee below the threshold and nothing at or above it', () => {
    expect(shippingFor(terms, 11)).toBe(9.9);
    expect(shippingFor(terms, 12)).toBe(0);
  });

  it('tells a company that never charges apart from an order that earned free delivery', () => {
    // Null and zero are different answers and the order dialog shows them
    // differently, which is why this is not one nullable number.
    expect(shippingFor(emptyCompanyTerms(), 50)).toBeNull();
    expect(shippingFor(terms, 50)).toBe(0);
  });

  it('always charges when nothing waives it', () => {
    expect(shippingFor({ ...terms, freeShippingFrom: null }, 500)).toBe(9.9);
  });
});
