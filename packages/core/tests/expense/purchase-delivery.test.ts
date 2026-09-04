/**
 * A purchase that arrives in more than one box.
 *
 * Built around a real one: a Zooplus order of five things and two discount
 * lines, of which two things came on the 31st. "What is still coming" is the
 * question somebody has with the first box open in front of them, and it was
 * unanswerable, because a purchase had one `deliveryDate` and one status that
 * was either `ordered` or `delivered`.
 *
 * The compatibility half matters as much as the feature. Every purchase note in
 * an existing vault has no `deliveries:` key, and reading one must not add it,
 * and its written status must go on being believed.
 */
import { describe, expect, it } from 'vitest';
import {
  outstandingLines,
  purchaseDeliveriesValue,
  purchaseStatusOf,
  readPurchaseDeliveries,
  type PurchaseDelivery,
  type PurchaseDeliveryProperties,
} from '../../src/expense/purchase-delivery.js';
import type { ExpenseLine } from '../../src/expense/types.js';
import { present } from '../testing.js';

const P: PurchaseDeliveryProperties = {
  deliveriesProperty: 'deliveries',
  deliveryDateField: 'date',
  deliveryItemsField: 'items',
  deliveryItemNameField: 'name',
  deliveryItemQuantityField: 'quantity',
  deliveryNoteField: 'note',
};

const line = (name: string, price: number | null = null, quantity = 1): ExpenseLine => ({
  name,
  price,
  quantity,
  discount: null,
  note: null,
});

/** The real order, lines and prices as the note holds them. */
const ZOOPLUS: ExpenseLine[] = [
  line('Lillebro Erdnusskerne gehackt', 57.9),
  line('Royal Canin Sterilised in Sosse - Sparpaket: 96 x 85 g', 138.9),
  line('Royal Canin Sterilised 37', 84.9),
  line('JR Garden Grainless Igelfutter', 15.5),
  line('Royal Canin Digestive Care in Sosse - Sparpaket: 96 x 85 g', 150.9),
  line('SparPlan-Rabatt', -22.41),
  line('Rabatt durch Gutschein', -53.39),
];

const firstBox: PurchaseDelivery = {
  date: '2026-08-31',
  items: [
    { name: 'Lillebro Erdnusskerne gehackt', quantity: 1 },
    { name: 'JR Garden Grainless Igelfutter', quantity: 1 },
  ],
  note: null,
};

describe('what is still coming', () => {
  it('is everything before anything arrives', () => {
    expect(outstandingLines(ZOOPLUS, [])).toHaveLength(ZOOPLUS.length);
  });

  it('drops what the first box brought', () => {
    const names = outstandingLines(ZOOPLUS, [firstBox]).map((item) => item.name);

    expect(names).not.toContain('Lillebro Erdnusskerne gehackt');
    expect(names).not.toContain('JR Garden Grainless Igelfutter');
    expect(names).toContain('Royal Canin Sterilised 37');
    expect(names).toHaveLength(5);
  });

  it('is empty once every line has come', () => {
    const rest: PurchaseDelivery = {
      date: '2026-09-04',
      items: ZOOPLUS.slice(1, 3)
        .concat(ZOOPLUS.slice(4))
        .map((item) => ({ name: item.name, quantity: 1 })),
      note: null,
    };

    expect(outstandingLines(ZOOPLUS, [firstBox, rest])).toEqual([]);
  });

  /**
   * A discount is a line of the order and has to be accounted for, or a
   * purchase can never read as complete. Recording one as "arrived" is odd on
   * paper and is the honest consequence of it being a line: the alternative is
   * a rule about which names are real, which no vault could agree on.
   */
  it('counts a discount line like any other, since that is what it is', () => {
    const names = outstandingLines(ZOOPLUS, [firstBox]).map((item) => item.name);
    expect(names).toContain('SparPlan-Rabatt');
  });

  it('matches a name the way a wikilink does, trimmed and ignoring case', () => {
    const box: PurchaseDelivery = {
      date: '2026-08-31',
      items: [{ name: '  lillebro ERDNUSSKERNE gehackt ', quantity: 1 }],
      note: null,
    };

    expect(outstandingLines(ZOOPLUS, [box]).map((item) => item.name)).not.toContain(
      'Lillebro Erdnusskerne gehackt'
    );
  });

  it('takes two of a line as two, and one of two as one still outstanding', () => {
    const two = [line('Filter', 5.5, 2)];
    const one: PurchaseDelivery = {
      date: null,
      items: [{ name: 'Filter', quantity: 1 }],
      note: null,
    };

    expect(outstandingLines(two, [one])).toEqual([{ name: 'Filter', quantity: 1 }]);
    expect(outstandingLines(two, [one, one])).toEqual([]);
  });
});

describe('the status it shows', () => {
  it('is partial once some of it has come', () => {
    expect(purchaseStatusOf('ordered', ZOOPLUS, [firstBox])).toBe('partial');
  });

  it('is delivered once all of it has', () => {
    const everything: PurchaseDelivery = {
      date: '2026-09-04',
      items: ZOOPLUS.map((item) => ({ name: item.name, quantity: 1 })),
      note: null,
    };

    expect(purchaseStatusOf('ordered', ZOOPLUS, [everything])).toBe('delivered');
  });

  /**
   * The compatibility rule, and the one this feature would be unusable without:
   * a note written before any of this exists carries no consignments, and its
   * status is a statement somebody made rather than one to be overruled.
   */
  it('believes the written status when nothing is recorded', () => {
    expect(purchaseStatusOf('delivered', ZOOPLUS, [])).toBe('delivered');
    expect(purchaseStatusOf('ordered', ZOOPLUS, [])).toBe('ordered');
  });

  /** Decisions, not observations. A returned purchase still arrived first. */
  it('leaves returned and cancelled alone whatever arrived', () => {
    expect(purchaseStatusOf('returned', ZOOPLUS, [firstBox])).toBe('returned');
    expect(purchaseStatusOf('cancelled', ZOOPLUS, [firstBox])).toBe('cancelled');
  });

  it('does not call a purchase with no lines delivered', () => {
    expect(purchaseStatusOf('ordered', [], [firstBox])).toBe('ordered');
  });
});

describe('reading and writing the list', () => {
  it('reads a consignment back as it was written', () => {
    const written = purchaseDeliveriesValue([firstBox], P);
    const read = readPurchaseDeliveries({ deliveries: written }, P);

    expect(read).toEqual([firstBox]);
  });

  /** A quantity of one is the default, so the common case reads as a list of names. */
  it('leaves out a quantity of one, and keeps a larger one', () => {
    const value = purchaseDeliveriesValue(
      [{ date: '2026-08-31', items: [{ name: 'Filter', quantity: 2 }], note: null }],
      P
    ) as Record<string, unknown>[];

    expect(present(value[0], 'value[0]').items).toEqual([{ name: 'Filter', quantity: 2 }]);

    const one = purchaseDeliveriesValue([firstBox], P) as Record<string, unknown>[];
    expect(present(one[0], 'one[0]').items).toEqual([
      { name: 'Lillebro Erdnusskerne gehackt' },
      { name: 'JR Garden Grainless Igelfutter' },
    ]);
  });

  /** Hand-editing the list is the fallback for everything the dialog cannot do. */
  it('reads a line written as a bare string', () => {
    const read = readPurchaseDeliveries(
      { deliveries: [{ date: '2026-08-31', items: ['Igelfutter', '  '] }] },
      P
    );

    expect(present(read[0], 'read[0]').items).toEqual([{ name: 'Igelfutter', quantity: 1 }]);
  });

  it('keeps a consignment that names no items, since somebody wrote the date down', () => {
    const read = readPurchaseDeliveries({ deliveries: [{ date: '2026-08-31' }] }, P);
    expect(read).toEqual([{ date: '2026-08-31', items: [], note: null }]);
  });

  /** Nothing to say, nothing written: this is what keeps an old note from being rewritten. */
  it('writes nothing at all when there are no consignments', () => {
    expect(purchaseDeliveriesValue([], P)).toBeUndefined();
  });

  it('reads a note that has no such key as having none', () => {
    expect(readPurchaseDeliveries({}, P)).toEqual([]);
    expect(readPurchaseDeliveries({ deliveries: 'nonsense' }, P)).toEqual([]);
  });
});
