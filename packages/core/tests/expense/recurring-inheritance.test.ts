/**
 * An invoice filled in from the arrangement it belongs to.
 *
 * The recurring note is where the insurer, the premium and the account are
 * already recorded, and an invoice under it repeats all three. Before this, the
 * invoice form asked for them again once a quarter, which is exactly how a
 * bill ends up booked to a different account than the standing cost it pays.
 *
 * The rule that earns the test is what happens to what is already on the form:
 * an arrangement fills a field it has an answer for and never empties one it
 * has not. Anything else makes picking the wrong cost destructive.
 */
import { describe, expect, it } from 'vitest';
import { inheritFromRecurring, type RecurringInheritance } from '../../src/expense/recurring.js';

const BLANK: RecurringInheritance = {
  companyTitle: null,
  areaTitle: null,
  category: null,
  amount: null,
  currency: null,
  account: null,
};

const PREMIUM = {
  companyTitle: 'Musterversicherung AG',
  areaTitle: 'Gesundheit',
  category: 'insurance',
  amount: 750.95,
  currency: 'CHF',
  account: 4031,
};

describe('an invoice taking what the arrangement already states', () => {
  it('fills an empty form from the cost', () => {
    expect(inheritFromRecurring(BLANK, PREMIUM)).toEqual(PREMIUM);
  });

  it('overwrites what was there, because the arrangement is the record', () => {
    const typed: RecurringInheritance = {
      companyTitle: 'Wrong AG',
      areaTitle: 'Hobbies',
      category: 'other',
      amount: 12,
      currency: 'EUR',
      account: 4036,
    };
    expect(inheritFromRecurring(typed, PREMIUM)).toEqual(PREMIUM);
  });

  it('leaves a field the cost says nothing about', () => {
    // The premium note has no area. That is not the same as saying the invoice
    // has none, so the area on the form survives.
    const vague = { ...PREMIUM, areaTitle: null, category: null };
    const typed = { ...BLANK, areaTitle: 'Haus & Wohnen', category: 'utilities' };
    const filled = inheritFromRecurring(typed, vague);
    expect(filled.areaTitle).toBe('Haus & Wohnen');
    expect(filled.category).toBe('utilities');
    expect(filled.companyTitle).toBe('Musterversicherung AG');
  });

  it('never empties a form, whatever the cost is missing', () => {
    const typed: RecurringInheritance = {
      companyTitle: 'Sunrise GmbH',
      areaTitle: 'Haus & Wohnen',
      category: 'telecom',
      amount: 156.6,
      currency: 'CHF',
      account: 4003,
    };
    expect(inheritFromRecurring(typed, BLANK)).toEqual(typed);
  });

  it('keeps the split rather than booking the whole invoice to one account', () => {
    // An invoice already divided across accounts has the more specific answer,
    // and taking the cost's single account would be a second claim about the
    // same money.
    const split = { ...BLANK, account: null };
    const filled = inheritFromRecurring(split, PREMIUM, { split: true });
    expect(filled.account).toBeNull();
    // Everything else still comes across.
    expect(filled.amount).toBe(750.95);
    expect(filled.companyTitle).toBe('Musterversicherung AG');
  });

  it('takes the account when the invoice is not split', () => {
    expect(inheritFromRecurring(BLANK, PREMIUM, { split: false }).account).toBe(4031);
  });

  it('treats a zero amount as an amount, not as nothing', () => {
    // A waived instalment is a real figure. Falling back to what was typed
    // would silently keep the old one.
    expect(inheritFromRecurring({ ...BLANK, amount: 99 }, { ...PREMIUM, amount: 0 }).amount).toBe(
      0
    );
  });

  it('treats account zero the same way', () => {
    expect(
      inheritFromRecurring({ ...BLANK, account: 4036 }, { ...PREMIUM, account: 0 }).account
    ).toBe(0);
  });

  it('does not mutate what it was given', () => {
    const typed = { ...BLANK, companyTitle: 'Wrong AG' };
    inheritFromRecurring(typed, PREMIUM);
    expect(typed.companyTitle).toBe('Wrong AG');
  });
});
