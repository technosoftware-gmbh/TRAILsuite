/**
 * Who owes whom, derived and never written.
 *
 * The cases that matter are the ones where a naive split lies: a booking
 * nobody is named on, a booking nobody paid, a currency the trip cannot
 * convert, and rounding that has to come out exact.
 */
import { describe, expect, it } from 'vitest';
import { tripSettlement, SettlementInput } from '../src/trips/costs/split';
import { ParsedBooking } from '../src/trips/costs/booking-note';

const STEFAN = 'Stefan Muster';
const ERIKA = 'Erika Muster';
const ANNA = 'Anna Meier';

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
    payerTitle: STEFAN,
    forTitles: [],
    documentPath: null,
    ...overrides,
  };
}

function input(overrides: Partial<SettlementInput> = {}): SettlementInput {
  return {
    bookings: [],
    participants: [STEFAN, ERIKA],
    currency: 'CHF',
    rates: [],
    ...overrides,
  };
}

function balanceOf(settlement: ReturnType<typeof tripSettlement>, person: string): number {
  return settlement.balances.find((entry) => entry.person === person)?.balance ?? 0;
}

describe('shares', () => {
  // Nobody named means everybody on the trip, which is the common case and
  // should not have to be typed on every booking.
  it('splits a booking that names nobody across the participants', () => {
    const settlement = tripSettlement(input({ bookings: [booking({ amount: 100 })] }));
    expect(balanceOf(settlement, STEFAN)).toBe(50);
    expect(balanceOf(settlement, ERIKA)).toBe(-50);
  });

  it('splits a booking only between the people it names', () => {
    const settlement = tripSettlement(
      input({
        participants: [STEFAN, ERIKA, ANNA],
        bookings: [booking({ amount: 90, forTitles: [ERIKA, ANNA] })],
      })
    );
    expect(balanceOf(settlement, STEFAN)).toBe(90);
    expect(balanceOf(settlement, ERIKA)).toBe(-45);
    expect(balanceOf(settlement, ANNA)).toBe(-45);
  });

  // It lowers everybody's balance evenly rather than pretending it was free.
  it('counts a booking nobody paid toward what people consumed', () => {
    const settlement = tripSettlement(
      input({ bookings: [booking({ amount: 80, payerTitle: null })] })
    );
    expect(balanceOf(settlement, STEFAN)).toBe(-40);
    expect(balanceOf(settlement, ERIKA)).toBe(-40);
    expect(settlement.payerCount).toBe(0);
  });

  it('leaves a cancelled booking out and counts a refunded one as nothing', () => {
    const settlement = tripSettlement(
      input({
        bookings: [
          booking({ amount: 500, status: 'cancelled' }),
          booking({ amount: 300, status: 'refunded' }),
        ],
      })
    );
    expect(settlement.balances.every((entry) => entry.balance === 0)).toBe(true);
  });
});

describe('currencies', () => {
  it('converts at the trip rate before splitting', () => {
    const settlement = tripSettlement(
      input({
        bookings: [booking({ amount: 100, currency: 'EUR' })],
        rates: [{ currency: 'EUR', rate: 0.94 }],
      })
    );
    expect(balanceOf(settlement, STEFAN)).toBe(47);
  });

  // A settlement that silently ignored a third of the spending would be
  // worse than one that admits its gap.
  it('leaves an unconvertible booking out and names the currency', () => {
    const settlement = tripSettlement(
      input({ bookings: [booking({ amount: 100, currency: 'ISK' })] })
    );
    expect(settlement.balances.every((entry) => entry.balance === 0)).toBe(true);
    expect(settlement.unconvertedCurrencies).toEqual(['ISK']);
  });
});

describe('transfers', () => {
  it('clears the balances exactly', () => {
    const settlement = tripSettlement(
      input({
        participants: [STEFAN, ERIKA, ANNA],
        bookings: [
          booking({ amount: 300, payerTitle: STEFAN }),
          booking({ amount: 60, payerTitle: ERIKA }),
        ],
      })
    );

    for (const balance of settlement.balances) {
      const out = settlement.transfers
        .filter((transfer) => transfer.from === balance.person)
        .reduce((sum, transfer) => sum + transfer.amount, 0);
      const back = settlement.transfers
        .filter((transfer) => transfer.to === balance.person)
        .reduce((sum, transfer) => sum + transfer.amount, 0);
      expect(Math.round((back - out) * 100) / 100).toBe(balance.balance);
    }
  });

  it('needs no transfers when everybody paid their own way', () => {
    const settlement = tripSettlement(
      input({
        bookings: [
          booking({ amount: 100, payerTitle: STEFAN, forTitles: [STEFAN] }),
          booking({ amount: 100, payerTitle: ERIKA, forTitles: [ERIKA] }),
        ],
      })
    );
    expect(settlement.transfers).toEqual([]);
  });

  // A settlement that leaves somebody a cent short is one people stop
  // trusting, so the rounding lands in a transfer rather than in a balance.
  it('comes out exact on a figure that does not divide', () => {
    const settlement = tripSettlement(
      input({ participants: [STEFAN, ERIKA, ANNA], bookings: [booking({ amount: 100 })] })
    );
    const total = settlement.transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    expect(Math.round(total * 100) / 100).toBe(balanceOf(settlement, STEFAN));
  });

  // The guard between "this is rounding" and "this is a fact about the trip":
  // an unpaid booking leaves everybody owing, and flattening that into one
  // person's column would invent a payer.
  it('leaves a genuine imbalance alone rather than absorbing it as rounding', () => {
    const settlement = tripSettlement(
      input({
        bookings: [
          booking({ amount: 100, payerTitle: STEFAN }),
          booking({ amount: 60, payerTitle: null }),
        ],
      })
    );
    const sum = settlement.balances.reduce((total, entry) => total + entry.balance, 0);
    expect(Math.round(sum * 100) / 100).toBe(-60);
  });

  it('reports how many people actually paid, so one payer can be a sentence', () => {
    const one = tripSettlement(input({ bookings: [booking({ amount: 100 })] }));
    expect(one.payerCount).toBe(1);

    const two = tripSettlement(
      input({
        bookings: [booking({ amount: 100 }), booking({ amount: 40, payerTitle: ERIKA })],
      })
    );
    expect(two.payerCount).toBe(2);
  });
});
