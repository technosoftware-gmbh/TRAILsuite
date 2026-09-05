/**
 * A delivery turned into the shared document model.
 *
 * The adapter carries this feature's tests for the same reason the order one
 * does: it is App-free, the renderer above it is thin, and the rules worth
 * pinning are all decided here. Two of them are the point of the file -- **no
 * money anywhere**, and the quantity column appearing exactly when the portions
 * total would otherwise look unaccountable.
 */
import { describe, expect, it } from 'vitest';
import { deliveryNote, type SettledOrder } from '../src/deliveries/delivery-note-model';
import { parseDelivery, type DeliveryProperties } from '@technosoftware/trail-core';
import type { DeliveryItem, ParsedDelivery } from '../src/deliveries/types';

const properties: DeliveryProperties = {
  typePropertyName: 'type',
  typeValue: 'delivery',
  deliveryDateProperty: 'deliveryDate',
  ordersProperty: 'orders',
  itemsProperty: 'items',
  itemMealField: 'meal',
  itemQuantityField: 'quantity',
};

const arrived = (mealTitle: string, quantity = 1): DeliveryItem => ({ mealTitle, quantity });

function delivery(overrides: Partial<ParsedDelivery> = {}): ParsedDelivery {
  return {
    deliveryDate: '2026-08-19',
    orderTitles: ['2026-08-14-23511'],
    items: [arrived('Risotto'), arrived('Lasagne')],
    ...overrides,
  };
}

const from = (title: string, companyTitle: string | null = 'TomTasty AG'): SettledOrder => ({
  title,
  companyTitle,
});

describe('the delivery document', () => {
  it('is the invoice without the money', () => {
    const model = deliveryNote(delivery(), [from('2026-08-14-23511')]);

    expect(model.currency).toBeNull();
    expect(model.columns.unitPrice).toBeNull();
    expect(model.columns.lineTotal).toBeNull();
    expect(model.lines.every((line) => line.unitPrice === null)).toBe(true);
    // A delivery has no number of its own: the date is its identity.
    expect(model.reference).toBeNull();
  });

  it('names the supplier off the orders it settles, since a delivery names none', () => {
    const model = deliveryNote(delivery(), [from('2026-08-14-23511')]);

    expect(model.documentLabel).toBe('Delivery');
    expect(model.counterparty).toBe('TomTasty AG');
  });

  it('shows both suppliers when one box settles two companies rather than picking one', () => {
    const model = deliveryNote(delivery({ orderTitles: ['a', 'b'] }), [
      from('a', 'TomTasty AG'),
      from('b', 'Fresh Fork GmbH'),
    ]);

    expect(model.counterparty).toBe('TomTasty AG, Fresh Fork GmbH');
  });

  it('says nothing about a supplier when the box settles no order', () => {
    const model = deliveryNote(delivery({ orderTitles: [] }), []);

    expect(model.counterparty).toBeNull();
    expect(model.footer).toBeNull();
  });

  it('states when it arrived, and nothing else', () => {
    const model = deliveryNote(delivery(), [from('2026-08-14-23511')]);

    expect(model.facts).toHaveLength(1);
    expect(model.facts[0]).toMatchObject({ label: 'Arrived', icon: 'truck' });
  });

  it('drops the date row for an undated delivery rather than printing an empty one', () => {
    expect(deliveryNote(delivery({ deliveryDate: null }), []).facts).toEqual([]);
  });
});

describe('the quantity column', () => {
  it('stays away when every dish arrived once, where it would be a column of 1s', () => {
    const model = deliveryNote(delivery(), []);

    expect(model.columns.quantity).toBeNull();
    expect(model.totals[0]).toEqual({ label: 'Portions', amount: '2', kind: 'total' });
  });

  it('appears as soon as one dish arrived twice, so the portions total adds up on screen', () => {
    const model = deliveryNote(
      delivery({ items: [arrived('Risotto', 2), arrived('Lasagne')] }),
      []
    );

    expect(model.columns.quantity).toBe('Qty');
    expect(model.lines.map((line) => line.quantity)).toEqual(['2', '1']);
    expect(model.totals[0].amount).toBe('3');
  });

  it('has no total at all for an empty box', () => {
    const model = deliveryNote(delivery({ items: [] }), []);

    expect(model.lines).toEqual([]);
    expect(model.totals).toEqual([]);
  });
});

describe('the orders it settles', () => {
  it('groups them under the supplier that shipped them', () => {
    const model = deliveryNote(delivery({ orderTitles: ['a', 'b'] }), [from('a'), from('b')]);

    expect(model.footer?.heading).toBe('Orders this settles');
    expect(model.footer?.groups).toHaveLength(1);
    expect(model.footer?.groups[0].label).toBe('TomTasty AG');
    expect(model.footer?.groups[0].entries.map((entry) => entry.label)).toEqual(['a', 'b']);
  });

  it('still lists an order whose note has gone, rather than hiding the broken link', () => {
    const model = deliveryNote(delivery({ orderTitles: ['gone'] }), [from('gone', null)]);

    expect(model.footer?.groups[0].label).toBe('No supplier');
    expect(model.footer?.groups[0].entries[0]).toEqual({ label: 'gone', linkTarget: 'gone' });
  });

  it('links every dish by title, so one whose note has moved still opens', () => {
    const model = deliveryNote(delivery(), []);

    expect(model.lines.map((line) => line.linkTarget)).toEqual(['Risotto', 'Lasagne']);
  });
});

describe('a note read off disk', () => {
  it('renders what the frontmatter says, quantities and all', () => {
    const parsed = parseDelivery({
      stem: '2026-08-19',
      frontmatter: {
        type: 'delivery',
        deliveryDate: '2026-08-19',
        orders: ['[[2026-08-14-23511]]'],
        items: [{ meal: '[[Risotto]]', quantity: 3 }, '[[Lasagne]]'],
      },
      properties,
    });
    const model = deliveryNote(parsed, [from('2026-08-14-23511')]);

    expect(model.lines.map((line) => line.label)).toEqual(['Risotto', 'Lasagne']);
    expect(model.columns.quantity).toBe('Qty');
    expect(model.totals[0].amount).toBe('4');
    expect(model.footer?.groups[0].entries[0].label).toBe('2026-08-14-23511');
  });
});
