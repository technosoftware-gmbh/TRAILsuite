/**
 * What a trip's bookings add up to.
 *
 * Three rules carry the weight, and each one exists because of a way a money
 * display can lie: a total over unpriced lines is null rather than zero,
 * currencies are never summed, and a figure the trip cannot convert is left
 * out of the converted total rather than added at an invented rate of one.
 */
import { describe, expect, it } from 'vitest';
import { tripCostTotals, TripCostInput } from '../src/trips/costs/totals';
import { BookingCategory, ParsedBooking } from '../src/trips/costs/booking-note';

function booking(overrides: Partial<ParsedBooking> = {}): ParsedBooking {
  return {
    tripTitle: 'Jura im Juni',
    category: 'transport',
    status: 'booked',
    supplierTitle: null,
    placeTitle: null,
    date: '2026-06-14',
    amount: 100,
    currency: null,
    reference: null,
    payerTitle: null,
    forTitles: [],
    documentPath: null,
    ...overrides,
  };
}

function input(overrides: Partial<TripCostInput> = {}): TripCostInput {
  return { bookings: [], budget: [], rates: [], currency: 'CHF', ...overrides };
}

function category(totals: ReturnType<typeof tripCostTotals>, name: BookingCategory) {
  return totals.byCategory.find((entry) => entry.category === name);
}

describe('the null-not-zero rule', () => {
  it('has no total at all for a trip with no bookings', () => {
    const totals = tripCostTotals(input());
    expect(totals.committedConverted).toBeNull();
    expect(category(totals, 'transport')?.committed).toBeNull();
  });

  // A trip whose bookings nobody has priced would otherwise show 0.00 next
  // to a budget of 1500 and read as a plugin that had lost the money.
  it('has no total for bookings nobody has priced', () => {
    const totals = tripCostTotals(input({ bookings: [booking({ amount: null })] }));
    expect(totals.committedConverted).toBeNull();
  });

  // Zero is a real amount: a comped night is a booking worth recording.
  it('counts a genuine zero', () => {
    const totals = tripCostTotals(input({ bookings: [booking({ amount: 0 })] }));
    expect(totals.committedConverted).toBe(0);
  });
});

describe('which status counts where', () => {
  const bookings = [
    booking({ amount: 100, status: 'estimate' }),
    booking({ amount: 200, status: 'booked' }),
    booking({ amount: 300, status: 'paid' }),
    booking({ amount: 900, status: 'cancelled' }),
    booking({ amount: 400, status: 'refunded' }),
  ];

  // A budget that only counts what is already booked reads as comfortable
  // right up to the moment it is not.
  it('counts estimates as committed', () => {
    expect(tripCostTotals(input({ bookings })).committedConverted).toBe(600);
  });

  it('counts only paid as paid', () => {
    expect(tripCostTotals(input({ bookings })).paidConverted).toBe(300);
  });

  it('leaves a cancelled booking out of every total and a refunded one in at zero', () => {
    const totals = tripCostTotals(input({ bookings }));
    expect(totals.committedConverted).toBe(600);
    expect(totals.statusCounts.cancelled).toBe(1);
    expect(totals.statusCounts.refunded).toBe(1);
  });
});

describe('currencies', () => {
  const mixed = [
    booking({ amount: 840, currency: 'CHF' }),
    booking({ amount: 220, currency: 'EUR' }),
  ];

  it('keeps a total per currency and never adds them together', () => {
    const totals = tripCostTotals(input({ bookings: mixed }));
    expect(totals.byCurrency.map((entry) => [entry.currency, entry.committed])).toEqual([
      ['CHF', 840],
      ['EUR', 220],
    ]);
  });

  // The plugin never invents a rate, so a currency the trip says nothing
  // about stays foreign and is named rather than silently dropped.
  it('leaves an unconvertible currency out of the converted total, and says which', () => {
    const totals = tripCostTotals(input({ bookings: mixed }));
    expect(totals.committedConverted).toBe(840);
    expect(totals.unconvertedCurrencies).toEqual(['EUR']);
  });

  it('converts at the rate the trip states, and only then', () => {
    const totals = tripCostTotals(
      input({ bookings: mixed, rates: [{ currency: 'EUR', rate: 0.94 }] })
    );
    expect(totals.committedConverted).toBe(1046.8);
    expect(totals.unconvertedCurrencies).toEqual([]);
  });

  // A booking that names no currency is in the trip's, which is what lets a
  // single-currency trip type a currency exactly zero times.
  it('reads a booking with no currency as the trip currency', () => {
    const totals = tripCostTotals(input({ bookings: [booking({ amount: 50 })] }));
    expect(totals.byCurrency[0].currency).toBe('CHF');
  });

  it('ignores a rate that is zero, negative or not a number', () => {
    for (const rate of [0, -1, Number.NaN]) {
      const totals = tripCostTotals(
        input({
          bookings: [booking({ amount: 10, currency: 'EUR' })],
          rates: [{ currency: 'EUR', rate }],
        })
      );
      expect(totals.unconvertedCurrencies).toEqual(['EUR']);
    }
  });
});

describe('plan against actual', () => {
  const bookings = [
    booking({ category: 'transport', amount: 380 }),
    booking({ category: 'accommodation', amount: 720 }),
  ];
  const budget = [
    { category: 'transport' as BookingCategory, amount: 400 },
    { category: 'accommodation' as BookingCategory, amount: 600 },
  ];

  it('reports the gap per category, in both directions', () => {
    const totals = tripCostTotals(input({ bookings, budget }));
    expect(category(totals, 'transport')?.variance).toBe(20);
    expect(category(totals, 'accommodation')?.variance).toBe(-120);
  });

  // "Unbudgeted" and "over budget by everything" are different statements
  // and only one of them is true.
  it('reports no variance for a category nobody budgeted', () => {
    const totals = tripCostTotals(input({ bookings: [booking({ category: 'food', amount: 60 })] }));
    expect(category(totals, 'food')?.planned).toBeNull();
    expect(category(totals, 'food')?.variance).toBeNull();
    expect(category(totals, 'food')?.committed).toBe(60);
  });

  it('adds the budget lines up for the trip total', () => {
    expect(tripCostTotals(input({ budget })).plannedTotal).toBe(1000);
  });
});

describe('cents', () => {
  // Floating point over two-decimal figures lands on 89.40000000000001, and
  // a total is money rather than a measurement.
  it('rounds a sum to the cent', () => {
    const totals = tripCostTotals(
      input({ bookings: [booking({ amount: 89.4 }), booking({ amount: 187.4 })] })
    );
    expect(totals.committedConverted).toBe(276.8);
  });

  it('rounds a conversion to the cent', () => {
    const totals = tripCostTotals(
      input({
        bookings: [booking({ amount: 220, currency: 'EUR' })],
        rates: [{ currency: 'EUR', rate: 0.9412 }],
      })
    );
    expect(totals.committedConverted).toBe(207.06);
  });
});

describe('status counts', () => {
  it('counts what is in each status, so a trip of booked and no paid looks like one', () => {
    const totals = tripCostTotals(
      input({
        bookings: [
          booking({ status: 'booked' }),
          booking({ status: 'booked' }),
          booking({ status: 'paid' }),
        ],
      })
    );
    expect(totals.statusCounts).toEqual({ booked: 2, paid: 1 });
  });
});
