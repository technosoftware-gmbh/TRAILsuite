/**
 * A card line, and the order note that already knows what it cost.
 *
 * Written against a real vault: sixty-one Tomtasty order notes and a Cornercard
 * statement whose legs name ten of them. Every one of the ten resolved and every
 * price agreed to the cent, which is what made this worth building rather than
 * guessing at.
 *
 * The two things a matcher like this can get badly wrong are both pinned below.
 * Attaching a charge to the wrong order is worse than finding nothing, so a
 * short digit run is not a candidate and an ISO date is not a number. And a
 * disagreement between the card and the order has to survive as a finding: the
 * card is what was charged, and quietly adopting the order's price would erase
 * exactly the refunds and part-deliveries this is best placed to catch.
 */
import { describe, expect, it } from 'vitest';
import {
  matchOrderForText,
  matchOrdersForLines,
  orderNumbersIn,
  type OrderForMatching,
} from '../../src/index.js';

function order(
  orderNumber: string,
  price: number | null,
  orderDate = '2025-12-12'
): OrderForMatching {
  return {
    title: `${orderDate}-${orderNumber}`,
    orderNumber,
    companyTitle: 'Tomtasty',
    orderDate,
    price,
    priceCurrency: 'CHF',
  };
}

const ORDERS = [
  order('21383', 155.7, '2025-12-12'),
  order('21739', 121.6, '2026-01-02'),
  order('22008', 92.15, '2026-01-09'),
  order('19702', 93.1, '2025-10-31'),
];

describe('reading the numbers out of a statement line', () => {
  it('finds a number written the way a merchant writes one', () => {
    expect(orderNumbersIn('TomTasty Bestellung #21383')).toContain('21383');
  });

  it('finds one with no hash, which is how some lines arrive', () => {
    expect(orderNumbersIn('2008744856, coop .ch')).toContain('2008744856');
  });

  it('prefers the hashed number, since nothing else on a line is written that way', () => {
    expect(orderNumbersIn('Rechnung 991234 zu Bestellung #21383')[0]).toBe('21383');
  });

  it('does not offer the parts of a date', () => {
    // `2026` would otherwise collide with an order numbered 2026.
    expect(orderNumbersIn('Lieferung 2026-01-02')).toEqual([]);
  });

  it('ignores a run too short to be an order number', () => {
    expect(orderNumbersIn('2 x Menu')).toEqual([]);
  });

  it('reads each number once, however often it is written', () => {
    expect(orderNumbersIn('#21383 storniert, neu #21383')).toEqual(['21383']);
  });
});

describe('matching a line to an order', () => {
  it('finds the order and confirms the figure', () => {
    const match = matchOrderForText('TomTasty Bestellung #21383', ORDERS, 155.7);
    expect(match?.order.orderNumber).toBe('21383');
    expect(match?.difference).toBe(0);
    expect(match?.alsoFits).toEqual([]);
  });

  it('survives the way the statement actually spells it', () => {
    // Two spaces, straight out of the card PDF.
    expect(matchOrderForText('Tomtasty  Bestellung #22008', ORDERS, 92.15)?.order.orderNumber).toBe(
      '22008'
    );
  });

  it('reports what the card charged over the order, rather than adopting the order', () => {
    const match = matchOrderForText('TomTasty #21739', ORDERS, 130);
    expect(match?.order.price).toBe(121.6);
    expect(match?.difference).toBe(8.4);
  });

  it('reports a refund the same way, as a negative difference', () => {
    expect(matchOrderForText('TomTasty #19702', ORDERS, 43.1)?.difference).toBe(-50);
  });

  it('matches an unpriced order without inventing a difference', () => {
    const unpriced = [order('30001', null)];
    const match = matchOrderForText('#30001', unpriced, 42);
    expect(match?.order.orderNumber).toBe('30001');
    expect(match?.difference).toBeNull();
  });

  it('offers no difference when no figure was given', () => {
    expect(matchOrderForText('#21383', ORDERS)?.difference).toBeNull();
  });

  it('finds nothing in a line that names no order', () => {
    expect(matchOrderForText('AQUILANA VERSICHERUNGEN', ORDERS, 750.95)).toBeNull();
  });

  it('finds nothing when the number is not one of ours', () => {
    expect(matchOrderForText('Bestellung #99999', ORDERS, 10)).toBeNull();
  });

  it('names the rest rather than choosing, when two notes share a number', () => {
    const twice = [order('21383', 155.7), order('21383', 155.7, '2025-12-13')];
    const match = matchOrderForText('#21383', twice, 155.7);
    expect(match?.alsoFits).toHaveLength(1);
  });

  it('says which number it matched on, so a person can check it', () => {
    expect(matchOrderForText('TomTasty Bestellung #21383', ORDERS)?.matchedOn).toBe('21383');
  });
});

describe('a whole split at once', () => {
  const legs = [
    { text: 'TomTasty #21383', amount: 155.7 },
    { text: 'Diverses', amount: 1050.57 },
    { text: 'TomTasty #21739', amount: 121.6 },
    { text: 'TomTasty #22008', amount: 92.15 },
  ];

  it('answers only for the lines that name an order', () => {
    const found = matchOrdersForLines(legs, ORDERS);
    expect(found).toHaveLength(3);
    expect(found.map((entry) => entry.match.order.orderNumber)).toEqual([
      '21383',
      '21739',
      '22008',
    ]);
  });

  it('hands back the line it was given, so a caller can act on its own row', () => {
    const found = matchOrdersForLines(legs, ORDERS);
    expect(found[0]?.line).toBe(legs[0]);
  });

  it('confirms every figure on a statement that agrees with the orders', () => {
    // The case from the vault: every leg to the cent.
    const found = matchOrdersForLines(legs, ORDERS);
    expect(found.every((entry) => entry.match.difference === 0)).toBe(true);
  });
});
