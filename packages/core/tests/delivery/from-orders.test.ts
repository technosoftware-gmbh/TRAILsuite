/**
 * What a delivery starts out saying, given the orders it settles.
 *
 * The subtraction is the whole of this: a meal company splits an order across
 * two boxes often enough that the second box's dialog has to know what the
 * first one already brought. Getting it wrong in either direction is quiet
 * (a dish listed twice, or a dish that never gets recorded), which is why the
 * partial-delivery case is tested from both ends.
 */
import { describe, expect, it } from 'vitest';
import { present } from '../testing.js';
import { deliveredCounts, orderedItems, outstandingItems } from '../../src/index.js';
import type { OrderedFrom } from '../../src/index.js';
import type { DeliveredIn } from '../../src/index.js';

const order = (title: string, picks: Array<[string, string, number]>): OrderedFrom => {
  const result: OrderedFrom = { title, selections: [] };

  for (const [person, meal, quantity] of picks) {
    let selection = result.selections.find((s) => s.personTitle === person);
    if (!selection) {
      selection = { personTitle: person, items: [] };
      result.selections.push(selection);
    }
    selection.items.push({ mealTitle: meal, price: null, quantity, discount: null });
  }

  return result;
};

const delivery = (orderTitles: string[], items: Array<[string, number]>): DeliveredIn => ({
  orderTitles,
  items: items.map(([mealTitle, quantity]) => ({ mealTitle, quantity })),
});

describe('orderedItems', () => {
  it('sums a dish across people, because a box is not addressed to anybody', () => {
    const result = orderedItems([
      order('2026-08-01-1', [
        ['Stefan', 'Pizza', 1],
        ['Anna', 'Pizza', 2],
        ['Anna', 'Risotto', 1],
      ]),
    ]);
    expect(result).toEqual([
      { mealTitle: 'Pizza', quantity: 3 },
      { mealTitle: 'Risotto', quantity: 1 },
    ]);
  });

  it('sums across orders too, since one box can settle two', () => {
    const result = orderedItems([
      order('2026-08-01-1', [['Stefan', 'Pizza', 1]]),
      order('2026-08-02-2', [['Stefan', 'Pizza', 2]]),
    ]);
    expect(result).toEqual([{ mealTitle: 'Pizza', quantity: 3 }]);
  });

  it('reads a quantity of zero as one, the way the order note does', () => {
    const result = orderedItems([order('2026-08-01-1', [['Stefan', 'Pizza', 0]])]);
    expect(present(result[0], 'result[0]').quantity).toBe(1);
  });
});

describe('deliveredCounts', () => {
  const deliveries = [
    delivery(['2026-08-01-1'], [['Pizza', 2]]),
    delivery(['2026-08-09-9'], [['Pizza', 5]]),
  ];

  it('counts only the deliveries that name one of these orders', () => {
    expect(deliveredCounts(['2026-08-01-1'], deliveries).get('pizza')).toBe(2);
  });

  it('ignores a box nobody linked, rather than guessing which order it settled', () => {
    // A guess here would silently mark an order complete that is not, and the
    // outstanding list is what somebody types the second box from.
    expect(deliveredCounts(['2026-08-01-1'], [delivery([], [['Pizza', 9]])]).size).toBe(0);
  });

  it('matches order titles the way a wikilink does', () => {
    expect(deliveredCounts([' 2026-08-01-1 '], deliveries).get('pizza')).toBe(2);
  });
});

describe('outstandingItems', () => {
  const ordered = [
    order('2026-08-01-1', [
      ['Stefan', 'Pizza', 3],
      ['Stefan', 'Risotto', 1],
    ]),
  ];

  it('is everything when nothing has arrived', () => {
    expect(outstandingItems(ordered, [])).toEqual([
      { mealTitle: 'Pizza', quantity: 3 },
      { mealTitle: 'Risotto', quantity: 1 },
    ]);
  });

  it('subtracts what the first box already brought', () => {
    const result = outstandingItems(ordered, [delivery(['2026-08-01-1'], [['Pizza', 1]])]);
    expect(result).toEqual([
      { mealTitle: 'Pizza', quantity: 2 },
      { mealTitle: 'Risotto', quantity: 1 },
    ]);
  });

  it('drops a dish that has fully arrived rather than listing it as none', () => {
    const result = outstandingItems(ordered, [delivery(['2026-08-01-1'], [['Risotto', 1]])]);
    expect(result.map((item) => item.mealTitle)).toEqual(['Pizza']);
  });

  it('drops a dish that over-arrived, since there is nothing left to prefill', () => {
    const result = outstandingItems(ordered, [delivery(['2026-08-01-1'], [['Pizza', 9]])]);
    expect(result.map((item) => item.mealTitle)).toEqual(['Risotto']);
  });

  it('is empty when the whole order has come', () => {
    const result = outstandingItems(ordered, [
      delivery(
        ['2026-08-01-1'],
        [
          ['Pizza', 3],
          ['Risotto', 1],
        ]
      ),
    ]);
    expect(result).toEqual([]);
  });

  it('leaves the order alone when the delivery settles a different one', () => {
    const result = outstandingItems(ordered, [delivery(['2026-07-01-7'], [['Pizza', 3]])]);
    expect(result).toEqual([
      { mealTitle: 'Pizza', quantity: 3 },
      { mealTitle: 'Risotto', quantity: 1 },
    ]);
  });
});
