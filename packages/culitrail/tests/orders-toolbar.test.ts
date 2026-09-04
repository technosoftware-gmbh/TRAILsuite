/**
 * What the orders toolbar leaves on screen, and in what order.
 *
 * Both modules are pure and take the orders as an argument, which is the whole
 * reason they are separate from the view: the rules that decide whether an
 * order is shown are worth testing, and a view that reads a vault is not
 * testable without one.
 *
 * The two rules worth pinning by name are the ones a reader would not guess.
 * **A missing value sorts last in both directions**, because an order with no
 * delivery date is not the earliest delivery, it is one with nothing to
 * compare. And **"no delivery logged" is a question about the other note**: a
 * delivery names the orders it settles, so an order is delivered when some
 * delivery says so, not when its own date property happens to be filled in.
 */
import { describe, expect, it } from 'vitest';
import {
  CLEARED_ORDER_FILTERS,
  deliveredOrderTitles,
  distinctCompanies,
  distinctYears,
  filterOrders,
  hasActiveOrderFilters,
} from '../src/orders/view-model/orders-filter';
import { sortOrders } from '../src/orders/view-model/orders-sort';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import type { OrdersSavedState } from '../src/settings/types';
import type { OrderRecord } from '../src/orders/types';

const state = (overrides: Partial<OrdersSavedState> = {}): OrdersSavedState => ({
  ...DEFAULT_SETTINGS.ordersSavedState,
  ...overrides,
});

/** Only the fields these two modules read; the rest of an order is not their business. */
function order(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    file: { path: 'Orders/x.md' },
    title: 'x',
    orderNumber: '1',
    companyTitle: 'TomTasty AG',
    orderDate: '2026-08-21',
    deliveryDate: null,
    price: 100,
    priceCurrency: 'CHF',
    discount: null,
    shipping: null,
    vatRate: null,
    vatAmount: null,
    selections: [],
    ...overrides,
  } as OrderRecord;
}

describe('the orders filter', () => {
  const orders = [
    order({ title: 'a', companyTitle: 'TomTasty AG', orderDate: '2026-08-21' }),
    order({ title: 'b', companyTitle: 'Kitchen Co', orderDate: '2025-02-01' }),
    order({ title: 'c', companyTitle: null, orderDate: null }),
  ];

  it('offers every company it has one for, alphabetically and without repeats', () => {
    expect(distinctCompanies([...orders, order({ title: 'd' })])).toEqual([
      'Kitchen Co',
      'TomTasty AG',
    ]);
  });

  it('offers the years orders were placed in, newest first', () => {
    expect(distinctYears(orders)).toEqual(['2026', '2025']);
  });

  it('narrows to one company', () => {
    const shown = filterOrders(orders, state({ company: 'Kitchen Co' }), new Set());
    expect(shown.map((o) => o.title)).toEqual(['b']);
  });

  it('narrows to one year, and an order with no date is in none of them', () => {
    const shown = filterOrders(orders, state({ year: '2026' }), new Set());
    expect(shown.map((o) => o.title)).toEqual(['a']);
  });

  it('finds an order by a dish somebody picked, not only by its company', () => {
    const withPicks = order({
      title: 'd',
      companyTitle: 'Kitchen Co',
      selections: [
        {
          personTitle: 'Erika',
          items: [{ mealTitle: 'Penne alla Norma', quantity: 1, price: null, discount: null }],
        },
      ],
    });

    const shown = filterOrders([...orders, withPicks], state({ search: 'penne' }), new Set());
    expect(shown.map((o) => o.title)).toEqual(['d']);
  });

  it('leaves out orders a delivery names, and only those', () => {
    const shown = filterOrders(orders, state({ withoutDelivery: true }), new Set(['a']));
    expect(shown.map((o) => o.title)).toEqual(['b', 'c']);
  });

  it('reads the delivered titles off the deliveries rather than off the orders', () => {
    expect(deliveredOrderTitles([{ orderTitles: ['a', 'b'] }, { orderTitles: ['b'] }])).toEqual(
      new Set(['a', 'b'])
    );
  });

  it('knows when a filter is on, and clearing turns them all off', () => {
    expect(hasActiveOrderFilters(state())).toBe(false);
    expect(hasActiveOrderFilters(state({ withoutDelivery: true }))).toBe(true);
    // Search is deliberately not cleared: it has its own visible field.
    const cleared = state({ company: 'Kitchen Co', search: 'penne', ...CLEARED_ORDER_FILTERS });
    expect(hasActiveOrderFilters(cleared)).toBe(false);
    expect(cleared.search).toBe('penne');
  });
});

describe('the orders sort', () => {
  const dated = [
    order({ title: 'old', orderDate: '2025-01-01' }),
    order({ title: 'new', orderDate: '2026-08-21' }),
    order({ title: 'undated', orderDate: null }),
  ];

  it('puts the newest first when descending', () => {
    expect(sortOrders(dated, 'order-date', 'desc').map((o) => o.title)).toEqual([
      'new',
      'old',
      'undated',
    ]);
  });

  it('keeps an order with no date last when ascending too', () => {
    expect(sortOrders(dated, 'order-date', 'asc').map((o) => o.title)).toEqual([
      'old',
      'new',
      'undated',
    ]);
  });

  it('sorts by what an order is worth, computing a total only where none is stated', () => {
    const orders = [
      order({ title: 'cheap', price: 10 }),
      order({ title: 'dear', price: 200 }),
      order({ title: 'unpriced', price: null }),
    ];
    expect(sortOrders(orders, 'total', 'desc').map((o) => o.title)).toEqual([
      'dear',
      'cheap',
      'unpriced',
    ]);
  });

  it('sorts by supplier, and breaks a tie by title so nothing swaps between renders', () => {
    const orders = [
      order({ title: 'b', companyTitle: 'TomTasty AG' }),
      order({ title: 'a', companyTitle: 'TomTasty AG' }),
      order({ title: 'c', companyTitle: 'Kitchen Co' }),
    ];
    expect(sortOrders(orders, 'company', 'asc').map((o) => o.title)).toEqual(['c', 'a', 'b']);
  });
});
