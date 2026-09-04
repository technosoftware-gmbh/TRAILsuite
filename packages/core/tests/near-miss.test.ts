/**
 * Payments the covering check misses, and the two ways it missed them.
 *
 * `postingsCovering` is strict on purpose, and its strictness fails closed into
 * the most expensive outcome the finance module has: the mark-paid dialog
 * offers to write a posting for a payment already in the books, and nothing on
 * screen says so. Both cases below are from a real vault, a fortnight apart.
 *
 * The pairing is what makes these tests worth having: each case asserts that
 * `postingsCovering` finds nothing AND that `paymentsNearMiss` finds it. Either
 * assertion alone would keep passing if the other function changed underneath.
 */
import { describe, expect, it } from 'vitest';
import { paymentsNearMiss, postingsCovering } from '../src/ledger/bill-match';
import type { Posting } from '../src/ledger/types';

function posting(date: string, debit: number | null, credit: number, amount: number): Posting {
  return {
    date,
    debit,
    credit,
    amount,
    currency: 'CHF',
    text: 'ORELL FUESSLI THALIA AG',
    reference: null,
    counterAmount: null,
    counterCurrency: null,
    line: 0,
    entryLine: 0,
    splitOf: null,
    importKey: null,
  };
}

describe('a payment booked to the wrong account', () => {
  // The invoice said 4039; the import had filed the payment to 4036.
  const ledger = [posting('2026-07-17', 4036, 1011, 79.7)];
  const legs = [{ account: 4039, amount: 79.7 }];

  it('is invisible to the covering check', () => {
    expect(postingsCovering(ledger, legs, 1011, '2026-07-01', '2026-07-31')).toEqual([]);
  });

  it('is reported, and says the account is what disagrees', () => {
    const [miss, ...rest] = paymentsNearMiss(ledger, legs, 1011, '2026-07-01', '2026-07-31');
    expect(rest).toEqual([]);
    expect(miss?.reason).toBe('account');
    expect(miss?.posting.date).toBe('2026-07-17');
  });
});

describe('a payment made after the window closes', () => {
  // Due on the 14th, paid on the 26th; the search reached the 19th.
  const ledger = [posting('2026-02-26', 4039, 1011, 45.5)];
  const legs = [{ account: 4039, amount: 45.5 }];

  it('is invisible to the covering check', () => {
    expect(postingsCovering(ledger, legs, 1011, '2026-02-04', '2026-02-14')).toEqual([]);
  });

  it('is reported, and says the date is what disagrees', () => {
    const [miss] = paymentsNearMiss(ledger, legs, 1011, '2026-02-04', '2026-02-14');
    expect(miss?.reason).toBe('date');
    expect(miss?.posting.date).toBe('2026-02-26');
  });

  it('stops being a near miss once the paid date reaches it', () => {
    // Which is the fix the message tells the reader to make.
    expect(postingsCovering(ledger, legs, 1011, '2026-02-04', '2026-02-26')).toHaveLength(1);
    expect(paymentsNearMiss(ledger, legs, 1011, '2026-02-04', '2026-02-26')).toEqual([]);
  });
});

describe('what is deliberately not reported', () => {
  it('says nothing about a same-amount payment months away', () => {
    // January's subscription is not July's invoice. Reporting it would teach
    // the reader to dismiss this warning, which is worse than not showing it.
    const ledger = [posting('2026-01-05', 4044, 1011, 29.1)];
    const legs = [{ account: 4044, amount: 29.1 }];
    expect(paymentsNearMiss(ledger, legs, 1011, '2026-07-06', '2026-07-31')).toEqual([]);
  });

  it('says nothing when both the account and the date are wrong', () => {
    // Two things off is not "the payment is there and one field is out"; it is
    // a different payment that happens to be the same size.
    const ledger = [posting('2026-02-26', 4036, 1011, 45.5)];
    const legs = [{ account: 4039, amount: 45.5 }];
    expect(paymentsNearMiss(ledger, legs, 1011, '2026-02-04', '2026-02-14')).toEqual([]);
  });

  it('says nothing about a payment from a different account', () => {
    const ledger = [posting('2026-07-17', 4039, 1005, 79.7)];
    const legs = [{ account: 4039, amount: 79.7 }];
    expect(paymentsNearMiss(ledger, legs, 1011, '2026-07-01', '2026-07-31')).toEqual([]);
  });

  it('stays quiet on a split, whose half-matches need a sentence each', () => {
    const ledger = [posting('2026-07-17', 4036, 1011, 40)];
    const legs = [
      { account: 4039, amount: 40 },
      { account: 4000, amount: 39.7 },
    ];
    expect(paymentsNearMiss(ledger, legs, 1011, '2026-07-01', '2026-07-31')).toEqual([]);
  });
});
