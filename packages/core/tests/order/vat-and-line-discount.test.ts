/**
 * The two things an order gained: a discount on one line, and a tax figure it
 * may state about a gross total.
 *
 * The VAT half is the one worth defending in a test. **Prices in these notes
 * are gross**, so tax is carved out of the total rather than added to it, and
 * the arithmetic for that is the one people get wrong: 2.6% of a gross figure
 * is not the tax inside it.
 */
import { describe, expect, it } from 'vitest';
import { computedOrderTotal, includedVat, itemTotal, orderSubtotal } from '../../src/index.js';
import type { OrderItem, OrderSelection, ParsedOrder } from '../../src/order/types.js';

const item = (
  mealTitle: string,
  price: number | null,
  quantity = 1,
  discount: number | null = null
): OrderItem => ({ mealTitle, price, quantity, discount });

const sel = (items: OrderItem[]): OrderSelection => ({ personTitle: 'Stefan', items });

const order = (over: Partial<ParsedOrder> = {}): ParsedOrder => ({
  orderNumber: '33335',
  companyTitle: 'TomTasty AG',
  orderDate: '2026-08-14',
  deliveryDate: null,
  price: null,
  priceCurrency: 'CHF',
  discount: null,
  shipping: null,
  vatRate: null,
  vatAmount: null,
  selections: [],
  ...over,
});

describe('a discount on one line', () => {
  it('comes off that line, before anything is summed', () => {
    expect(itemTotal(item('Pizza', 20, 1, 10))).toBeCloseTo(18, 5);
  });

  it('applies after the quantity, not before it', () => {
    // Three at twenty, ten percent off the line: 54, not 20 - 10% then tripled
    // by some other rule. They agree here, and the test says which is meant.
    expect(itemTotal(item('Pizza', 20, 3, 10))).toBeCloseTo(54, 5);
  });

  it('is inside the subtotal rather than an adjustment to it', () => {
    // The distinction that matters: an invoice that showed the full 40 and then
    // corrected it would be wrong about which dish was cheap.
    const both = order({ selections: [sel([item('Pizza', 20, 1, 50), item('Risotto', 20)])] });
    expect(orderSubtotal(both)).toBe(30);
  });

  it('leaves a line alone when it states none', () => {
    expect(itemTotal(item('Pizza', 21.9, 2))).toBeCloseTo(43.8, 5);
  });

  it('clamps a nonsense percentage rather than paying the customer', () => {
    // A hand-typed 120 is a typo. A line worth minus four francs would quietly
    // reduce the rest of the order, which is the failure nobody would trace.
    expect(itemTotal(item('Pizza', 20, 1, 120))).toBe(0);
    expect(itemTotal(item('Pizza', 20, 1, -10))).toBe(20);
  });

  it('says nothing about a line with no price', () => {
    expect(itemTotal(item('Pizza', null, 1, 10))).toBeNull();
  });
});

describe('the tax inside a gross total', () => {
  it('prefers the amount the invoice states over the rate', () => {
    // Paper wins. Recomputing from the rate would land a cent off the invoice
    // for no gain, and the note is a record of what was charged.
    const stated = order({ price: 102.9, vatRate: 2.6, vatAmount: 2.61 });
    expect(includedVat(stated)).toBe(2.61);
  });

  it('carves the rate out of the gross rather than adding it on top', () => {
    // 102.90 gross at 2.6%: 102.90 - 102.90 / 1.026 = 2.607..., not 2.6% of
    // 102.90, which would be 2.68.
    expect(includedVat(order({ price: 102.9, vatRate: 2.6 }))).toBeCloseTo(2.61, 2);
  });

  it('falls back to the computed total when no total was stated', () => {
    const computed = order({ vatRate: 2.6, selections: [sel([item('Pizza', 102.9)])] });
    expect(computedOrderTotal(computed)).toBe(102.9);
    expect(includedVat(computed)).toBeCloseTo(2.61, 2);
  });

  it('says nothing for an order that states neither', () => {
    // Every order written before this existed, and every company that does not
    // break the tax out. Null rather than zero: no claim, not a claim of none.
    expect(includedVat(order({ price: 102.9 }))).toBeNull();
  });

  it('says nothing for a rate with no total to apply it to', () => {
    expect(includedVat(order({ vatRate: 2.6 }))).toBeNull();
  });

  it('ignores a rate of zero rather than dividing by one and reporting nothing', () => {
    expect(includedVat(order({ price: 102.9, vatRate: 0 }))).toBeNull();
  });
});
