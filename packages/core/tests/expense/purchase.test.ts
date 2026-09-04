import { describe, expect, it } from 'vitest';
import {
  buildPurchaseFrontmatter,
  parsePurchase,
  parsePurchaseFilenameStem,
  purchaseFilenameStem,
  purchaseIncludedVat,
  purchaseSubtotal,
  purchaseTotalsDisagree,
  computedPurchaseTotalOf,
  type PurchaseProperties,
} from '../../src/expense/purchase.js';
import {
  adjustedTotal,
  includedVatOf,
  lineTotal,
  linesSubtotal,
  statedDisagreesWithComputed,
} from '../../src/expense/total.js';

const P: PurchaseProperties = {
  typePropertyName: 'type',
  typeValue: 'purchase',
  referenceProperty: 'reference',
  companyProperty: 'company',
  areaProperty: 'area',
  projectProperty: 'project',
  categoryProperty: 'category',
  statusProperty: 'status',
  dateProperty: 'orderDate',
  deliveryDateProperty: 'deliveryDate',
  amountProperty: 'amount',
  currencyProperty: 'currency',
  discountProperty: 'discount',
  shippingProperty: 'shipping',
  vatRateProperty: 'vatRate',
  vatAmountProperty: 'vatAmount',
  itemsProperty: 'items',
  itemNameField: 'name',
  itemPriceField: 'price',
  itemQuantityField: 'quantity',
  itemDiscountField: 'discount',
  itemNoteField: 'note',
  documentProperty: 'document',
  billProperty: 'bill',
  deliveriesProperty: 'deliveries',
  deliveryDateField: 'date',
  deliveryItemsField: 'items',
  deliveryItemNameField: 'name',
  deliveryItemQuantityField: 'quantity',
  deliveryNoteField: 'note',
};

describe('the filename', () => {
  it('is the date and the vendor reference', () => {
    expect(purchaseFilenameStem(new Date(2026, 7, 22), '82455495')).toBe('2026-08-22-82455495');
  });

  it('is the date alone when there is no reference', () => {
    expect(purchaseFilenameStem(new Date(2026, 7, 22), '  ')).toBe('2026-08-22');
  });

  it('reverses, and refuses a name that does not start with a date', () => {
    expect(parsePurchaseFilenameStem('2026-08-22-82455495')).toEqual({
      date: '2026-08-22',
      reference: '82455495',
    });
    expect(parsePurchaseFilenameStem('Galaxus Bestellung')).toBeNull();
  });
});

describe('parsePurchase', () => {
  it('reads a full note', () => {
    const purchase = parsePurchase({
      stem: '2026-08-22-82455495',
      frontmatter: {
        company: '[[Galaxus]]',
        area: '[[Haus & Wohnen]]',
        category: 'household',
        status: 'delivered',
        deliveryDate: '2026-08-25',
        amount: 189.4,
        currency: 'chf',
        shipping: 8.9,
        vatRate: 8.1,
        items: [
          { name: 'Staubsauger', price: 169.5 },
          { name: 'Filter', price: 5.5, quantity: 2 },
        ],
        document: '1 Areas/6 Finanzen/Rechnungen/Galaxus_Rechnung_82455495.pdf',
      },
      properties: P,
    });

    expect(purchase.reference).toBe('82455495');
    expect(purchase.companyTitle).toBe('Galaxus');
    expect(purchase.areaTitle).toBe('Haus & Wohnen');
    expect(purchase.status).toBe('delivered');
    expect(purchase.currency).toBe('CHF');
    expect(purchase.date).toBe('2026-08-22');
    expect(purchase.items).toHaveLength(2);
    expect(purchase.items[1]?.quantity).toBe(2);
  });

  it('lets the property beat the filename for the date', () => {
    const purchase = parsePurchase({
      stem: '2026-08-22-1',
      frontmatter: { orderDate: '2026-08-01' },
      properties: P,
    });
    expect(purchase.date).toBe('2026-08-01');
  });

  it('reads an unknown status as ordered rather than as nothing', () => {
    const purchase = parsePurchase({ stem: 'x', frontmatter: { status: 'wat' }, properties: P });
    expect(purchase.status).toBe('ordered');
  });

  it('reads a company typed without brackets, because a person meant the same thing', () => {
    const purchase = parsePurchase({
      stem: 'x',
      frontmatter: { company: 'Galaxus' },
      properties: P,
    });
    expect(purchase.companyTitle).toBe('Galaxus');
  });

  it('reads a bare string among the items as an unpriced line', () => {
    const purchase = parsePurchase({
      stem: 'x',
      frontmatter: { items: ['Kabel', { name: 'Stecker', price: 4 }] },
      properties: P,
    });
    expect(purchase.items[0]).toEqual({
      name: 'Kabel',
      price: null,
      quantity: 1,
      discount: null,
      note: null,
    });
  });

  it('floors a quantity of zero at one, so a line is never read as free', () => {
    const purchase = parsePurchase({
      stem: 'x',
      frontmatter: { items: [{ name: 'Kabel', price: 4, quantity: 0 }] },
      properties: P,
    });
    expect(purchase.items[0]?.quantity).toBe(1);
  });

  it('drops a line naming nothing', () => {
    const purchase = parsePurchase({
      stem: 'x',
      frontmatter: { items: [{ price: 4 }, 'ok'] },
      properties: P,
    });
    expect(purchase.items.map((line) => line.name)).toEqual(['ok']);
  });

  it('reads an empty note without inventing anything', () => {
    const purchase = parsePurchase({ stem: 'x', frontmatter: {}, properties: P });
    expect(purchase.amount).toBeNull();
    expect(purchase.items).toEqual([]);
    expect(purchase.date).toBeNull();
  });
});

describe('buildPurchaseFrontmatter', () => {
  const content = {
    companyTitle: 'Galaxus',
    areaTitle: null,
    projectTitle: null,
    category: 'household',
    status: 'ordered' as const,
    date: '2026-08-22',
    deliveryDate: null,
    amount: 189.4,
    currency: 'CHF',
    discount: null,
    shipping: 8.9,
    vatRate: null,
    vatAmount: null,
    items: [
      { name: 'Staubsauger', price: 169.5, quantity: 1, discount: null, note: null },
      { name: 'Filter', price: 5.5, quantity: 2, discount: 10, note: 'Ersatz' },
    ],
    deliveries: [],
    documentPaths: [],
    billTitle: null,
    reference: 'ORD-8814',
  };

  const frontmatter = buildPurchaseFrontmatter(P, content);

  it('writes the type first and the company as a link', () => {
    expect(Object.keys(frontmatter)[0]).toBe('type');
    expect(frontmatter.company).toBe('[[Galaxus]]');
  });

  it('omits what the note has nothing to say about', () => {
    expect(frontmatter).not.toHaveProperty('deliveryDate');
    expect(frontmatter).not.toHaveProperty('area');
    expect(frontmatter).not.toHaveProperty('discount');
  });

  it('leaves a quantity of one off the line', () => {
    const lines = frontmatter.items as Record<string, unknown>[];
    expect(lines[0]).toEqual({ name: 'Staubsauger', price: 169.5 });
    expect(lines[1]).toEqual({
      name: 'Filter',
      price: 5.5,
      quantity: 2,
      discount: 10,
      note: 'Ersatz',
    });
  });

  it('round-trips through the parser', () => {
    const back = parsePurchase({ stem: '2026-08-22-1', frontmatter, properties: P });
    expect(back.items).toEqual(content.items);
    expect(back.companyTitle).toBe('Galaxus');
    expect(back.shipping).toBe(8.9);
  });
});

describe('the arithmetic', () => {
  it('multiplies a line by its quantity and takes its own discount off', () => {
    expect(lineTotal({ price: 10, quantity: 2, discount: 10 })).toBe(18);
  });

  it('reads an unpriced line as unpriced rather than as free', () => {
    expect(lineTotal({ price: null, quantity: 2, discount: null })).toBeNull();
  });

  it('clamps a nonsense discount rather than paying somebody to buy something', () => {
    expect(lineTotal({ price: 10, quantity: 1, discount: 120 })).toBe(0);
    expect(lineTotal({ price: 10, quantity: 1, discount: -50 })).toBe(10);
  });

  it('returns nothing at all when no line is priced', () => {
    expect(linesSubtotal([{ price: null, quantity: 1, discount: null }])).toBeNull();
    expect(linesSubtotal([])).toBeNull();
  });

  it('sums to the cent', () => {
    expect(linesSubtotal([{ price: 29.8, quantity: 3, discount: null }])).toBe(89.4);
  });

  it('applies discount and shipping to the whole thing, and only when there is a sum', () => {
    expect(adjustedTotal(100, 10, 8.9)).toBe(98.9);
    expect(adjustedTotal(null, 10, 8.9)).toBeNull();
  });

  it('says nothing about a disagreement it cannot see', () => {
    expect(statedDisagreesWithComputed(100, null)).toBe(false);
    expect(statedDisagreesWithComputed(null, 100)).toBe(false);
    expect(statedDisagreesWithComputed(100, 100.004)).toBe(false);
    expect(statedDisagreesWithComputed(100, 101)).toBe(true);
  });

  it('carves the tax out of a gross figure rather than adding it on', () => {
    // 8.1% of a gross 108.10 is not 8.76; the tax inside it is 8.10.
    expect(includedVatOf(108.1, 8.1, null)).toBe(8.1);
  });

  it('lets a stated amount beat a rate', () => {
    expect(includedVatOf(108.1, 8.1, 8)).toBe(8);
  });

  it('says nothing where the note states neither', () => {
    expect(includedVatOf(108.1, null, null)).toBeNull();
    expect(includedVatOf(null, 8.1, null)).toBeNull();
  });
});

describe('a purchase total', () => {
  const purchase = parsePurchase({
    stem: '2026-08-22-1',
    frontmatter: {
      amount: 189.4,
      shipping: 8.9,
      vatRate: 8.1,
      items: [
        { name: 'Staubsauger', price: 169.5 },
        { name: 'Filter', price: 5.5, quantity: 2 },
      ],
    },
    properties: P,
  });

  it('sums the lines and applies the shipping', () => {
    expect(purchaseSubtotal(purchase)).toBe(180.5);
    expect(computedPurchaseTotalOf(purchase)).toBe(189.4);
  });

  it('agrees with the stated total, to the cent', () => {
    expect(purchaseTotalsDisagree(purchase)).toBe(false);
    expect(purchaseTotalsDisagree({ ...purchase, amount: 200 })).toBe(true);
  });

  it('says nothing about a purchase whose lines carry no prices', () => {
    const unpriced = { ...purchase, items: [] };
    expect(computedPurchaseTotalOf(unpriced)).toBeNull();
    // Not a disagreement: there is simply nothing to compare.
    expect(purchaseTotalsDisagree(unpriced)).toBe(false);
  });

  it('carves the tax out of the stated gross', () => {
    expect(purchaseIncludedVat(purchase)).toBe(14.19);
  });
});

describe('a purchase reference, once it is a property', () => {
  it('is read from the property', () => {
    const parsed = parsePurchase({
      stem: '20260814_Galaxus_ORD-8814',
      frontmatter: { reference: 'ORD-8814' },
      properties: P,
    });
    expect(parsed.reference).toBe('ORD-8814');
  });

  it('still comes off the name of a note written the old way', () => {
    // Every purchase note in the vault predates the property. Reading them has
    // to keep working, or the reference silently vanishes from all of them.
    const parsed = parsePurchase({
      stem: '2026-08-14-ORD-8814',
      frontmatter: {},
      properties: P,
    });
    expect(parsed.reference).toBe('ORD-8814');
    expect(parsed.date).toBe('2026-08-14');
  });

  it('takes the property over the name when a note carries both', () => {
    // A note renamed by hand keeps the reference it states, because that is the
    // one somebody typed on purpose.
    const parsed = parsePurchase({
      stem: '2026-08-14-OLD-1',
      frontmatter: { reference: 'ORD-8814' },
      properties: P,
    });
    expect(parsed.reference).toBe('ORD-8814');
  });

  it('is empty when neither says, rather than invented from a title', () => {
    const parsed = parsePurchase({ stem: 'Staubsauger', frontmatter: {}, properties: P });
    expect(parsed.reference).toBe('');
  });
});
