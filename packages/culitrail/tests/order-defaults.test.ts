/**
 * What an order starts out saying, given who it is from.
 *
 * The rule this file exists to hold is that these are **defaults**. Nothing
 * here is applied to an order that already exists, and what the dialog writes
 * is a plain number: a company raising its shipping next year must not change
 * what an order from today says.
 */
import { describe, expect, it } from 'vitest';
import { orderDefaults, orderedMealCount } from '../src/orders/company-defaults';
import { emptyCompanyTerms, readDiscountTiers } from '../src/crm/company-terms';
import type { OrderItem, OrderSelection } from '../src/orders/types';

const item = (mealTitle: string, quantity = 1): OrderItem => ({
  mealTitle,
  price: 17,
  quantity,
  discount: null,
});

const sel = (personTitle: string, items: OrderItem[]): OrderSelection => ({ personTitle, items });

const tomTasty = {
  ...emptyCompanyTerms(),
  currency: 'CHF',
  shippingFee: 9.9,
  freeShippingFrom: 12,
  discountTiers: readDiscountTiers(['6: 5', '12: 10']),
};

describe('counting what was ordered', () => {
  it('counts portions across every person, not lines and not people', () => {
    const selections = [
      sel('Stefan', [item('Pizza', 2), item('Risotto')]),
      sel('Erika', [item('Pizza')]),
    ];
    expect(orderedMealCount(selections)).toBe(4);
  });

  it('counts a line with a nonsense quantity as one rather than none', () => {
    expect(orderedMealCount([sel('Stefan', [item('Pizza', 0)])])).toBe(1);
  });
});

describe('what a company offers a new order', () => {
  it('takes the currency, the shipping fee and the rung the count reaches', () => {
    const selections = [sel('Stefan', [item('Pizza', 6)])];
    const defaults = orderDefaults(tomTasty, selections, 102);

    expect(defaults.currency).toBe('CHF');
    expect(defaults.shipping).toBe(9.9);
    expect(defaults.discountPercent).toBe(5);
    expect(defaults.discount).toBeCloseTo(5.1, 2);
  });

  it('waives the shipping once the order is big enough', () => {
    const selections = [sel('Stefan', [item('Pizza', 12)])];
    const defaults = orderDefaults(tomTasty, selections, 204);

    expect(defaults.shipping).toBe(0);
    expect(defaults.discountPercent).toBe(10);
    expect(defaults.discount).toBeCloseTo(20.4, 2);
  });

  it('offers a discount in money rather than in percent', () => {
    // The note holds an amount because that is what the rest of the order holds
    // and what an invoice prints. A percentage stored against a total that
    // later changes is two figures that disagree.
    expect(orderDefaults(tomTasty, [sel('T', [item('Pizza', 6)])], 100).discount).toBe(5);
  });

  it('offers no discount when nothing is priced to take one from', () => {
    // The rung still applies to the count; there is simply no sum to apply it
    // to, and inventing one would be a figure with nothing behind it.
    const defaults = orderDefaults(tomTasty, [sel('T', [item('Pizza', 6)])], null);
    expect(defaults.discountPercent).toBe(5);
    expect(defaults.discount).toBeNull();
  });

  it('offers nothing at all for a company that states no terms', () => {
    const defaults = orderDefaults(emptyCompanyTerms(), [sel('T', [item('Pizza')])], 17);
    expect(defaults).toEqual({
      currency: null,
      shipping: null,
      discount: null,
      discountPercent: 0,
    });
  });

  it('tells no shipping apart from free shipping', () => {
    // Null is a company that never charges; zero is this order having earned
    // free delivery. The dialog shows them differently.
    const never = { ...tomTasty, shippingFee: null };
    expect(orderDefaults(never, [sel('T', [item('Pizza')])], 17).shipping).toBeNull();
    expect(orderDefaults(tomTasty, [sel('T', [item('Pizza', 20)])], 340).shipping).toBe(0);
  });
});
