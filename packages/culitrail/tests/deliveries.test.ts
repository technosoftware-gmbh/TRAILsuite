/**
 * The delivery note: what arrived, and when.
 *
 * The shape is deliberately the order note's, so the two read alike. What is
 * tested here is the part that differs: a delivery links to orders rather than
 * being owned by one, because a box can settle two orders and an order can
 * arrive in two boxes.
 */
import { describe, expect, it } from 'vitest';
import {
  buildDeliveryFrontmatter,
  deliveryFilenameStem,
  deliveryTitles,
  parseDelivery,
  parseDeliveryFilenameStem,
  type DeliveryProperties,
} from 'trail-core';
import { lastDeliveredTitles, newestDelivery } from '../src/deliveries/read-deliveries';
import type { DeliveryRecord } from '../src/deliveries/types';

const properties: DeliveryProperties = {
  typePropertyName: 'type',
  typeValue: 'delivery',
  deliveryDateProperty: 'deliveryDate',
  ordersProperty: 'orders',
  itemsProperty: 'items',
  itemMealField: 'meal',
  itemQuantityField: 'quantity',
};

const parse = (stem: string, frontmatter: Record<string, unknown>) =>
  parseDelivery({ stem, frontmatter, properties });

describe('the filename', () => {
  it('is the date, with a suffix only when two boxes share a day', () => {
    expect(deliveryFilenameStem('2026-08-19')).toBe('2026-08-19');
    expect(deliveryFilenameStem('2026-08-19', 'second')).toBe('2026-08-19-second');
  });

  it('reads the date back, suffix or not', () => {
    expect(parseDeliveryFilenameStem('2026-08-19')?.deliveryDate).toBe('2026-08-19');
    expect(parseDeliveryFilenameStem('2026-08-19-second')?.deliveryDate).toBe('2026-08-19');
  });

  it('is null for a note that merely sits in the folder', () => {
    expect(parseDeliveryFilenameStem('Notes about the freezer')).toBeNull();
  });
});

describe('the note format', () => {
  const content = {
    deliveryDate: '2026-08-19',
    orderTitles: ['2026-08-14-34598'],
    items: [
      { mealTitle: 'Tantanmen Ramen Suppe', quantity: 2 },
      { mealTitle: 'Penne alla Norma ⚖️', quantity: 1 },
    ],
  };

  it('writes the type, the date, the orders and the lines', () => {
    expect(buildDeliveryFrontmatter(properties, content)).toEqual({
      type: 'delivery',
      deliveryDate: '2026-08-19',
      orders: ['[[2026-08-14-34598]]'],
      items: [
        { meal: '[[Tantanmen Ramen Suppe]]', quantity: 2 },
        // A quantity of one is the absence of a quantity, the way an order line
        // omits it.
        { meal: '[[Penne alla Norma ⚖️]]' },
      ],
    });
  });

  it('round-trips through the writer and the reader', () => {
    expect(parse('2026-08-19', buildDeliveryFrontmatter(properties, content))).toEqual(content);
  });

  it('omits an absent field rather than writing it empty', () => {
    const frontmatter = buildDeliveryFrontmatter(properties, {
      deliveryDate: null,
      orderTitles: [],
      items: [],
    });
    expect(Object.keys(frontmatter)).toEqual(['type']);
  });

  it('takes a bare wikilink as a line, since most boxes hold one of each', () => {
    const read = parse('2026-08-19', { items: ['[[Pizza]]', '[[Risotto]]'] });
    expect(read.items).toEqual([
      { mealTitle: 'Pizza', quantity: 1 },
      { mealTitle: 'Risotto', quantity: 1 },
    ]);
  });

  it('links several orders, because one box can settle two', () => {
    const read = parse('2026-08-19', { orders: ['[[2026-08-14-1]]', '[[2026-08-15-2]]'] });
    expect(read.orderTitles).toEqual(['2026-08-14-1', '2026-08-15-2']);
  });

  it('floors a quantity of zero at one rather than reading it as nothing', () => {
    const read = parse('2026-08-19', { items: [{ meal: '[[Pizza]]', quantity: 0 }] });
    expect(read.items[0].quantity).toBe(1);
  });

  it('takes the date from the filename when the note states none', () => {
    expect(parse('2026-08-19-second', {}).deliveryDate).toBe('2026-08-19');
  });

  it('prefers the property over the filename, since a person corrects the property', () => {
    expect(parse('2026-08-19', { deliveryDate: '2026-08-20' }).deliveryDate).toBe('2026-08-20');
  });
});

describe('the last delivery', () => {
  const delivery = (deliveryDate: string | null, titles: string[]): DeliveryRecord =>
    ({
      file: { path: `${deliveryDate ?? 'undated'}.md` },
      title: deliveryDate ?? 'undated',
      deliveryDate,
      orderTitles: [],
      items: titles.map((mealTitle) => ({ mealTitle, quantity: 1 })),
    }) as unknown as DeliveryRecord;

  // As `readDeliveries` returns them: newest first.
  const deliveries = [
    delivery('2026-08-19', ['Pizza', 'Risotto']),
    delivery('2026-08-05', ['Lasagne']),
  ];

  it('is the newest one', () => {
    expect(newestDelivery(deliveries)?.deliveryDate).toBe('2026-08-19');
  });

  it('skips an undated note rather than calling it the newest', () => {
    // "The last one" is a claim about time, and a note stating no date cannot
    // support it however it happens to sort.
    expect(newestDelivery([delivery(null, ['Mystery']), ...deliveries])?.deliveryDate).toBe(
      '2026-08-19'
    );
  });

  it('gives its meals, lower-cased, for matching against the picker', () => {
    expect(lastDeliveredTitles(deliveries)).toEqual(new Set(['pizza', 'risotto']));
  });

  it('is empty when nothing has arrived', () => {
    expect(lastDeliveredTitles([])).toEqual(new Set());
    expect(newestDelivery([])).toBeNull();
  });
});

describe('what is in the box', () => {
  it('lists the titles in the order the note names them', () => {
    expect(
      deliveryTitles({
        items: [
          { mealTitle: 'Pizza', quantity: 2 },
          { mealTitle: 'Risotto', quantity: 1 },
        ],
      })
    ).toEqual(['Pizza', 'Risotto']);
  });
});
