/**
 * An order turned into the format-agnostic invoice model.
 *
 * The adapter carries the weight of this feature's tests on purpose: it is
 * App-free, and the renderer above it is deliberately thin enough that
 * everything worth asserting is decided here. The rule these cases exist for is
 * the one about unpriced orders: all 59 notes in the vault this was built
 * against carry no line prices, and a document giving them price columns of
 * dashes and a computed 0.00 would read as a plugin that had lost the money.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { orderInvoice } from '../src/orders/invoice-model';
import { parseOrder, type OrderProperties } from 'trail-core';
import type { OrderItem, OrderSelection, ParsedOrder } from '../src/orders/types';

const settings = mergeSettings({});

const properties: OrderProperties = {
  typePropertyName: 'type',
  typeValue: 'order',
  companyProperty: 'company',
  orderDateProperty: 'orderDate',
  deliveryDateProperty: 'deliveryDate',
  priceProperty: 'price',
  priceCurrencyProperty: 'priceCurrency',
  selectionsProperty: 'selections',
  selectionPersonField: 'person',
  selectionMealsField: 'meals',
  selectionItemsField: 'items',
  itemMealField: 'meal',
  itemPriceField: 'price',
  itemQuantityField: 'quantity',
  itemDiscountField: 'discount',
  discountProperty: 'discount',
  shippingProperty: 'shipping',
  vatRateProperty: 'vatRate',
  vatAmountProperty: 'vatAmount',
};

const item = (
  mealTitle: string,
  price: number | null,
  quantity = 1,
  discount: number | null = null
): OrderItem => ({
  mealTitle,
  price,
  quantity,
  discount,
});

const sel = (personTitle: string, items: OrderItem[]): OrderSelection => ({ personTitle, items });

function order(overrides: Partial<ParsedOrder> = {}): ParsedOrder {
  return {
    orderNumber: '33335',
    companyTitle: 'TomTasty AG',
    orderDate: '2026-07-24',
    deliveryDate: '2026-07-26',
    price: null,
    priceCurrency: 'CHF',
    discount: null,
    shipping: null,
    vatRate: null,
    vatAmount: null,
    selections: [],
    ...overrides,
  };
}

/** One dish chosen by two people, plus one chosen by one. */
const priced = order({
  price: 65.5,
  discount: 5,
  shipping: 3.5,
  selections: [
    sel('Stefan Muster', [item('Risotto', 24.5), item('Lasagne', 18)]),
    sel('Ada Lovelace', [item('Risotto', 24.5)]),
  ],
});

describe('a priced order as an invoice', () => {
  const model = orderInvoice(priced, settings);

  it('heads the document with its number and its supplier', () => {
    expect(model.reference).toBe('#33335');
    expect(model.counterparty).toBe('TomTasty AG');
    expect(model.currency).toBe('CHF');
  });

  it('states when it was ordered and when it came, and every figure but the total', () => {
    // The discount and the shipping are facts here, not steps in a sum: there is
    // one total on this document and the lines above are what explain it.
    expect(model.facts.map((fact) => fact.label)).toEqual([
      'Ordered',
      'Delivered',
      'Discount',
      'Shipping',
    ]);
    expect(model.facts.map((fact) => fact.value).slice(2)).toEqual(['5.00', '3.50']);
  });

  it('shows every column, because the lines carry prices', () => {
    expect(model.columns.quantity).not.toBeNull();
    expect(model.columns.unitPrice).not.toBeNull();
    expect(model.columns.lineTotal).not.toBeNull();
  });

  it('has one row per distinct dish, counted across everybody who chose it', () => {
    // The same dish picked by two people is one row of two portions, not two
    // rows. A price belongs to the dish, not to the person.
    expect(model.lines).toEqual([
      {
        label: 'Risotto',
        linkTarget: 'Risotto',
        quantity: '2',
        unitPrice: '24.50',
        lineTotal: '49.00',
      },
      {
        label: 'Lasagne',
        linkTarget: 'Lasagne',
        quantity: '1',
        unitPrice: '18.00',
        lineTotal: '18.00',
      },
    ]);
  });

  it('shows one total, added up from the lines', () => {
    // 24.50 x 2 + 18.00 = 67.00, less the 5.00 discount, plus 3.50 shipping.
    expect(model.totals).toEqual([{ label: 'Total', amount: '65.50', kind: 'total' }]);
  });

  it('states the VAT already inside the total as a fact, since it is not a step towards it', () => {
    const model = orderInvoice(order({ ...priced, vatRate: 8.1 }), settings);

    expect(model.facts.map((fact) => [fact.label, fact.value])).toContainEqual([
      'incl. 8.1% VAT',
      '4.91',
    ]);
    expect(model.totals).toHaveLength(1);
  });

  it('totals a priced order from its lines even when the note states another figure', () => {
    // The editor computes what it writes, so a stated total that disagrees is a
    // note edited by hand. The lines are the record it was derived from, and a
    // second row saying otherwise is what this document stopped doing.
    const model = orderInvoice(order({ ...priced, price: 70 }), settings);

    expect(model.totals).toEqual([{ label: 'Total', amount: '65.50', kind: 'total' }]);
  });
});

describe('an unpriced order as an invoice', () => {
  const unpriced = order({
    price: 84.5,
    selections: [
      sel('Stefan Muster', [item('Risotto', null), item('Lasagne', null)]),
      sel('Ada Lovelace', [item('Pizza', null)]),
    ],
  });
  const model = orderInvoice(unpriced, settings);

  it('omits the arithmetic entirely rather than showing a column of dashes', () => {
    expect(model.columns.unitPrice).toBeNull();
    expect(model.columns.lineTotal).toBeNull();
    // Nothing to say: every dish was ordered once.
    expect(model.columns.quantity).toBeNull();
  });

  it('still lists the dishes', () => {
    expect(model.lines.map((line) => line.label)).toEqual(['Risotto', 'Lasagne', 'Pizza']);
  });

  it('uses the total somebody typed, because there is nothing to add up', () => {
    expect(model.totals).toEqual([{ label: 'Total', amount: '84.50', kind: 'total' }]);
  });

  it('keeps the quantity column when a dish was ordered twice', () => {
    const twice = order({
      selections: [
        sel('Stefan Muster', [item('Risotto', null)]),
        sel('Ada Lovelace', [item('Risotto', null)]),
      ],
    });
    const model = orderInvoice(twice, settings);

    expect(model.columns.quantity).not.toBeNull();
    expect(model.lines).toHaveLength(1);
    expect(model.lines[0].quantity).toBe('2');
  });

  it('reports a discount as a fact here too, and still shows one total', () => {
    const model = orderInvoice(order({ ...unpriced, discount: 5, shipping: 2 }), settings);

    expect(model.facts.map((fact) => fact.label)).toEqual([
      'Ordered',
      'Delivered',
      'Discount',
      'Shipping',
    ]);
    expect(model.totals.map((total) => total.kind)).toEqual(['total']);
  });
});

describe('an order with nothing chosen', () => {
  const model = orderInvoice(order({ price: 12 }), settings);

  it('renders no table and no footer', () => {
    expect(model.lines).toEqual([]);
    expect(model.footer).toBeNull();
  });

  it('still states what it cost', () => {
    expect(model.totals.map((total) => total.amount)).toEqual(['12.00']);
  });
});

describe('the footer', () => {
  it('is one group per person, their dishes in the order the note names them', () => {
    const model = orderInvoice(priced, settings);

    expect(model.footer?.heading).toBe('Who ordered what');
    expect(model.footer?.groups).toEqual([
      {
        label: 'Stefan Muster',
        entries: [
          { label: 'Risotto', linkTarget: 'Risotto' },
          { label: 'Lasagne', linkTarget: 'Lasagne' },
        ],
      },
      {
        label: 'Ada Lovelace',
        entries: [{ label: 'Risotto', linkTarget: 'Risotto' }],
      },
    ]);
  });

  it('names a dish twice when one person ordered it twice', () => {
    // The table aggregates; the footer is the record of who asked for what.
    const model = orderInvoice(
      order({ selections: [sel('Stefan Muster', [item('Pizza', null), item('Pizza', null)])] }),
      settings
    );

    expect(model.footer?.groups[0].entries).toHaveLength(2);
  });
});

describe('a note read off disk', () => {
  it('renders a v1 order, whose picks live in a flat property per person', () => {
    const parsed = parseOrder({
      stem: '2026-07-24-33335',
      frontmatter: {
        company: '[[TomTasty AG]]',
        orderDate: '2026-07-24',
        price: 41.2,
        priceCurrency: 'CHF',
        selectionStefan: ['[[Risotto]]', '[[Lasagne]]'],
      },
      properties,
      legacyPrefix: 'selection',
      personTitles: ['Stefan Muster'],
    });
    const model = orderInvoice(parsed, settings);

    expect(model.lines.map((line) => line.label)).toEqual(['Risotto', 'Lasagne']);
    // v1 predates line prices by two formats, so it is an unpriced order.
    expect(model.columns.unitPrice).toBeNull();
    expect(model.totals).toEqual([{ label: 'Total', amount: '41.20', kind: 'total' }]);
    expect(model.footer?.groups[0].label).toBe('Stefan Muster');
  });

  it('renders a v3 order, whose lines carry their own prices', () => {
    const parsed = parseOrder({
      stem: '2026-07-24-33336',
      frontmatter: {
        company: '[[TomTasty AG]]',
        orderDate: '2026-07-24',
        price: 30,
        priceCurrency: 'CHF',
        selections: [
          { person: '[[Ada Lovelace]]', items: [{ meal: '[[Pizza]]', price: 15, quantity: 2 }] },
        ],
      },
      properties,
      legacyPrefix: 'selection',
      personTitles: [],
    });
    const model = orderInvoice(parsed, settings);

    expect(model.lines[0]).toMatchObject({ quantity: '2', unitPrice: '15.00', lineTotal: '30.00' });
    expect(model.totals).toEqual([{ label: 'Total', amount: '30.00', kind: 'total' }]);
  });
});
