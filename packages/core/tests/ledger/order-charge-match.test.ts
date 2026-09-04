/**
 * Matching a card charge to an order when neither names the other.
 *
 * The statement line this was written against is a real Revolut export row:
 *
 *   Kartenbezahlung,Giro,2026-04-03 11:09:41,2026-04-04 03:04:06,Tom Tasty,
 *   -97.85,0.00,CHF,ABGESCHLOSSEN,701.98
 *
 * It prints the merchant, the figure and two dates, and no order number
 * anywhere. The order note that goes with it is `2026-04-03-26303`, priced
 * 97.85, company `[[TomTasty AG]]`. So there is nothing to match on but the
 * merchant, the amount and the day -- and the merchant is written two different
 * ways by the two systems, which is the first thing this has to survive.
 */
import { describe, expect, it } from 'vitest';
import {
  matchOrderForCharge,
  type ChargeToMatch,
  type OrderForMatching,
} from '../../src/ledger/order-match.js';

function charge(overrides: Partial<ChargeToMatch> = {}): ChargeToMatch {
  return {
    text: 'Tom Tasty',
    amount: -97.85,
    currency: 'CHF',
    // Revolut books the completed date and starts the day before.
    date: '2026-04-04',
    valueDate: '2026-04-03',
    ...overrides,
  };
}

function order(overrides: Partial<OrderForMatching> = {}): OrderForMatching {
  return {
    title: '2026-04-03-26303',
    orderNumber: '26303',
    companyTitle: 'TomTasty AG',
    orderDate: '2026-04-03',
    price: 97.85,
    priceCurrency: 'CHF',
    ...overrides,
  };
}

describe('a card charge with no order number on it', () => {
  it('finds the order across the space the two systems disagree about', () => {
    // `TomTasty AG` and `Tom Tasty` share no whole word. Matching on words
    // alone finds nothing here, which is why the run-together forms are
    // compared too.
    const match = matchOrderForCharge(charge(), [order()]);
    expect(match?.order.orderNumber).toBe('26303');
    expect(match?.daysApart).toBe(0);
    expect(match?.alsoFits).toEqual([]);
  });

  it('uses the started date, which is the one the order falls on', () => {
    // Booked on the 4th, begun on the 3rd, ordered on the 3rd. Judged on the
    // booked date alone this is a day out; on the nearer of the two it is exact.
    expect(matchOrderForCharge(charge(), [order()])?.daysApart).toBe(0);
  });

  it('still matches an export that offers only one date', () => {
    const match = matchOrderForCharge(charge({ valueDate: null }), [order()]);
    expect(match?.daysApart).toBe(1);
  });

  it('needs the price to agree to the cent', () => {
    expect(matchOrderForCharge(charge({ amount: -97.8 }), [order()])).toBeNull();
  });

  it('needs the currency to agree', () => {
    expect(matchOrderForCharge(charge({ currency: 'EUR' }), [order()])).toBeNull();
  });

  it('needs the merchant to be named', () => {
    expect(matchOrderForCharge(charge({ text: 'COOP-1234 ZUERICH' }), [order()])).toBeNull();
  });

  it('ignores money coming in, which buys nothing', () => {
    expect(matchOrderForCharge(charge({ amount: 97.85 }), [order()])).toBeNull();
  });

  it('will not reach forward to an order not yet placed', () => {
    // These arrive weekly and a repeat order repeats its price exactly. What
    // keeps one week from answering for the next is not a narrow window but the
    // direction of time: a charge cannot pay for an order placed after it.
    const nextWeek = order({
      title: '2026-04-10-26728',
      orderNumber: '26728',
      orderDate: '2026-04-10',
    });
    expect(matchOrderForCharge(charge(), [nextWeek])).toBeNull();
  });

  it('reaches back far enough for a merchant that settles slowly', () => {
    // Every Haushaltskonto charge in the real vault landed exactly three days
    // after its order, which is where a symmetric window would have had to
    // stop. One day slower and it would have found nothing, and said nothing.
    const slow = charge({ date: '2026-04-09', valueDate: null });
    expect(matchOrderForCharge(slow, [order()])?.daysApart).toBe(6);
  });

  it('stops before a week, where the next order begins', () => {
    const later = charge({ date: '2026-04-10', valueDate: null });
    expect(matchOrderForCharge(later, [order()])).toBeNull();
  });

  it('forgives one day of midnight disagreement, and no more', () => {
    const eve = charge({ date: '2026-04-02', valueDate: null });
    const earlier = charge({ date: '2026-04-01', valueDate: null });
    expect(matchOrderForCharge(eve, [order()])).not.toBeNull();
    expect(matchOrderForCharge(earlier, [order()])).toBeNull();
  });
});

describe('an order already paid for', () => {
  it('is not offered a second time', () => {
    // The error this exists to prevent: two charges pointing at one order. Both
    // are real money that really left the account, so the books close either
    // way and nothing that works on figures alone would ever notice.
    const match = matchOrderForCharge(charge(), [order()], { taken: new Set(['26303']) });
    expect(match).toBeNull();
  });

  it('leaves the next unpaid order of the same price findable', () => {
    const later = order({
      title: '2026-04-05-26401',
      orderNumber: '26401',
      orderDate: '2026-04-05',
    });
    const match = matchOrderForCharge(charge(), [order(), later], { taken: new Set(['26303']) });
    expect(match?.order.orderNumber).toBe('26401');
  });
});

describe('when two orders fit equally well', () => {
  const twin = order({ title: '2026-04-03-26304', orderNumber: '26304' });

  it('reports both rather than choosing', () => {
    const match = matchOrderForCharge(charge(), [order(), twin]);
    expect(match?.alsoFits).toHaveLength(1);
  });

  it('does choose when one is strictly nearer the charge', () => {
    const further = order({
      title: '2026-04-01-26290',
      orderNumber: '26290',
      orderDate: '2026-04-01',
    });
    const match = matchOrderForCharge(charge(), [further, order()]);
    expect(match?.order.orderNumber).toBe('26303');
    expect(match?.alsoFits).toEqual([]);
  });
});
