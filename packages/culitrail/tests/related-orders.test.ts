/**
 * Which orders a Person or a Company note is the subject of.
 *
 * The matching is the whole risk here: an order names people and meals as
 * wikilink titles, and a case or whitespace difference between the note's
 * filename and what the order says would make the block render "no orders yet"
 * on a person who has ordered forty times.
 */
import { describe, expect, it } from 'vitest';
import {
  orderTotal,
  ordersForCompany,
  ordersForPerson,
  ordersForMeal,
} from '../src/orders/related-orders';
import type { OrderRecord, OrderSelection } from '../src/orders/types';
import { selectionTitles } from '@technosoftware/trail-core';

function order(
  orderNumber: string,
  companyTitle: string | null,
  selections: OrderSelection[],
  price: number | null = null,
  priceCurrency: string | null = 'CHF'
): OrderRecord {
  return {
    file: { path: `Eating/Orders/${orderNumber}.md` },
    title: orderNumber,
    orderNumber,
    companyTitle,
    orderDate: '2026-08-01',
    deliveryDate: null,
    price,
    priceCurrency,
    selections,
  } as unknown as OrderRecord;
}

const sel = (personTitle: string, mealTitles: string[] = []): OrderSelection => ({
  personTitle,
  items: mealTitles.map((mealTitle) => ({ mealTitle, price: null, quantity: 1, discount: null })),
});

describe('orders for a person', () => {
  it('finds the orders naming them, and only their own selection', () => {
    const orders = [
      order('1', 'TomTasty AG', [sel('Stefan', ['Lasagne']), sel('Erika', ['Risotto'])]),
    ];
    const mine = ordersForPerson(orders, 'Erika');

    expect(mine.length).toBe(1);
    expect(selectionTitles(mine[0].selection)).toEqual(['Risotto']);
  });

  it('ignores an order nobody by that name is on', () => {
    expect(ordersForPerson([order('1', 'TomTasty AG', [sel('Stefan')])], 'Gaby')).toEqual([]);
  });

  it('matches a title case-insensitively and trimmed', () => {
    // The note's filename and what the order's wikilink says are two strings
    // typed at different times. A block that rendered nothing over a capital
    // letter would look like a parsing bug.
    const orders = [order('1', null, [sel('  stefan muster  ')])];
    expect(ordersForPerson(orders, 'Stefan Muster').length).toBe(1);
  });

  it('keeps an order where they chose nothing yet', () => {
    // A real state: somebody recorded who was in on the order before deciding
    // what they wanted. Dropping it would make the order look unrelated to them.
    const mine = ordersForPerson([order('1', 'TomTasty AG', [sel('Stefan', [])])], 'Stefan');

    expect(mine.length).toBe(1);
    expect(selectionTitles(mine[0].selection)).toEqual([]);
  });

  it('preserves the order it was given, which is newest first', () => {
    const orders = [
      order('3', null, [sel('Stefan')]),
      order('2', null, [sel('Erika')]),
      order('1', null, [sel('Stefan')]),
    ];
    expect(ordersForPerson(orders, 'Stefan').map((entry) => entry.order.orderNumber)).toEqual([
      '3',
      '1',
    ]);
  });

  it('takes one selection per order even if the person is listed twice', () => {
    // A hand-edited note can carry two entries for one person. Two rows for one
    // order would read as two orders.
    const orders = [order('1', null, [sel('Stefan', ['Lasagne']), sel('Stefan', ['Pizza'])])];
    expect(ordersForPerson(orders, 'Stefan').length).toBe(1);
  });
});

describe('orders for a company', () => {
  it('finds the orders placed with it', () => {
    const orders = [
      order('1', 'TomTasty AG', [sel('Stefan')]),
      order('2', 'Other Ltd', [sel('Stefan')]),
    ];
    expect(ordersForCompany(orders, 'TomTasty AG').map((o) => o.orderNumber)).toEqual(['1']);
  });

  it('matches case-insensitively and trimmed', () => {
    const orders = [order('1', ' tomtasty ag ', [])];
    expect(ordersForCompany(orders, 'TomTasty AG').length).toBe(1);
  });

  it('never matches an order with no company', () => {
    // A blank company must not collide with a company note whose title happens
    // to be blank-ish, and it certainly must not match every note.
    expect(ordersForCompany([order('1', null, [])], 'TomTasty AG')).toEqual([]);
    expect(ordersForCompany([order('1', null, [])], '')).toEqual([]);
  });
});

describe('the total', () => {
  it('adds the priced orders', () => {
    const total = orderTotal([order('1', 'A', [], 10.5), order('2', 'A', [], 4.5)]);
    expect(total).toEqual({ amount: 15, currency: 'CHF' });
  });

  it('ignores an unpriced order rather than counting it as zero', () => {
    const total = orderTotal([order('1', 'A', [], 10), order('2', 'A', [], null)]);
    expect(total?.amount).toBe(10);
  });

  it('gives nothing when no order carries a price', () => {
    // So a block can leave the total out rather than print a confident zero for
    // a company whose orders nobody priced.
    expect(orderTotal([order('1', 'A', [], null)])).toBeNull();
  });

  it('gives nothing for a mixed-currency run', () => {
    // Adding CHF to EUR produces a number that is wrong in both. No total is
    // more useful than a plausible one.
    const total = orderTotal([order('1', 'A', [], 10, 'CHF'), order('2', 'A', [], 10, 'EUR')]);
    expect(total).toBeNull();
  });

  it('treats a missing currency as part of the same run rather than a second one', () => {
    // One order left without a currency should not suppress the total for a
    // household that only ever uses one.
    const total = orderTotal([order('1', 'A', [], 10, 'CHF'), order('2', 'A', [], 5, null)]);
    expect(total).toEqual({ amount: 15, currency: 'CHF' });
  });

  it('gives nothing for an empty run', () => {
    expect(orderTotal([])).toBeNull();
  });
});

describe('orders for a meal', () => {
  it('finds the orders naming the dish, newest first', () => {
    const orders = [
      order('2', 'TomTasty AG', [sel('Stefan', ['Lasagne'])], null, 'CHF'),
      order('3', 'Other Ltd', [sel('Erika', ['Risotto'])]),
      order('1', 'TomTasty AG', [sel('Erika', ['Lasagne', 'Risotto'])]),
    ];
    orders[0].orderDate = '2026-05-01';
    orders[1].orderDate = '2026-06-01';
    orders[2].orderDate = '2026-07-01';

    // Newest first is the whole point: the caller asks who sold us this most
    // recently, and sorting here keeps that one decision in one place.
    expect(ordersForMeal(orders, 'Lasagne').map((o) => o.orderNumber)).toEqual(['1', '2']);
  });

  it('matches a title case-insensitively and trimmed', () => {
    const orders = [order('1', 'TomTasty AG', [sel('Stefan', ['  lasagne  '])])];
    expect(ordersForMeal(orders, 'Lasagne')).toHaveLength(1);
  });

  it('sorts an undated order last, since it cannot be the most recent thing', () => {
    const dated = order('1', 'A', [sel('Stefan', ['Lasagne'])]);
    const undated = order('2', 'B', [sel('Stefan', ['Lasagne'])]);
    undated.orderDate = null;

    expect(ordersForMeal([undated, dated], 'Lasagne').map((o) => o.orderNumber)).toEqual([
      '1',
      '2',
    ]);
  });

  it('finds nothing for a dish no order names', () => {
    expect(ordersForMeal([order('1', 'A', [sel('Stefan', ['Lasagne'])])], 'Pizza')).toEqual([]);
  });
});
