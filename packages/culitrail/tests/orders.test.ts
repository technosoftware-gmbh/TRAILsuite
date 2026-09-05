/**
 * An order note's filename and frontmatter, round-tripped.
 *
 * The writer and the reader are tested against each other on purpose: an
 * order note is the one thing CULItrail writes that somebody is unlikely to
 * read back in Markdown, so a mistake in it would sit unnoticed for a long
 * time.
 */
import { describe, expect, it } from 'vitest';
import {
  buildOrderFrontmatter,
  hasLegacySelections,
  legacySelectionProperty,
  orderFilenameStem,
  parseOrder,
  parseOrderFilenameStem,
  type OrderProperties,
} from '@technosoftware/trail-core';
import { ordersForMeal } from '../src/orders/read-orders';
import type { OrderRecord, OrderSelection } from '../src/orders/types';

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

/**
 * A selection, given titles and optionally prices.
 *
 * A helper rather than object literals, because the shape changed once already:
 * `mealTitles: string[]` became a list of priced items, and every fixture in this
 * file had to be rewritten by hand.
 */
const sel = (
  personTitle: string,
  mealTitles: string[],
  prices: (number | null)[] = []
): OrderSelection => ({
  personTitle,
  items: mealTitles.map((mealTitle, index) => ({
    mealTitle,
    price: prices[index] ?? null,
    quantity: 1,
    discount: null,
  })),
});

const content = {
  companyTitle: 'TomTasty AG',
  orderDate: '2026-07-24',
  deliveryDate: '2026-07-26',
  price: 84.5,
  priceCurrency: 'CHF',
  discount: null,
  shipping: null,
  vatRate: null,
  vatAmount: null,
  selections: [sel('Stefan Muster', ['Risotto', 'Lasagne']), sel('Ada Lovelace', ['Pizza'])],
};

function read(
  frontmatter: Record<string, unknown>,
  stem = '2026-07-24-33335',
  personTitles: string[] = []
) {
  return parseOrder({
    stem,
    frontmatter,
    properties,
    legacyPrefix: 'selection',
    personTitles,
  });
}

describe('orderFilenameStem', () => {
  it('is the date and the number', () => {
    expect(orderFilenameStem(new Date(2026, 6, 24), '33335')).toBe('2026-07-24-33335');
  });

  it('is just the date when no number was given', () => {
    expect(orderFilenameStem(new Date(2026, 6, 24), '  ')).toBe('2026-07-24');
  });

  it('round-trips through the parser', () => {
    expect(parseOrderFilenameStem('2026-07-24-33335')).toEqual({
      orderDate: '2026-07-24',
      orderNumber: '33335',
    });
    expect(parseOrderFilenameStem('2026-07-24')).toEqual({
      orderDate: '2026-07-24',
      orderNumber: '',
    });
  });

  it('is null for a note that merely sits in the folder', () => {
    // Otherwise a note called "Suppliers" gets a nonsense order number
    // invented from its title.
    expect(parseOrderFilenameStem('Suppliers')).toBeNull();
    expect(parseOrderFilenameStem('July orders')).toBeNull();
  });
});

describe('buildOrderFrontmatter', () => {
  it('writes the type, and links the company and every pick', () => {
    const frontmatter = buildOrderFrontmatter(properties, content);
    expect(frontmatter.type).toBe('order');
    expect(frontmatter.company).toBe('[[TomTasty AG]]');
    expect(frontmatter.selections).toEqual([
      { person: '[[Stefan Muster]]', meals: ['[[Risotto]]', '[[Lasagne]]'] },
      { person: '[[Ada Lovelace]]', meals: ['[[Pizza]]'] },
    ]);
  });

  it('omits an absent field rather than writing it empty', () => {
    // A note holding `deliveryDate:` with nothing after it says something
    // different from one that never had the property.
    const frontmatter = buildOrderFrontmatter(properties, {
      ...content,
      companyTitle: null,
      deliveryDate: null,
      price: null,
      priceCurrency: null,
    });
    expect(Object.keys(frontmatter)).toEqual(['type', 'orderDate', 'selections']);
  });

  it('writes a price of zero, which is a real price', () => {
    const frontmatter = buildOrderFrontmatter(properties, { ...content, price: 0 });
    expect(frontmatter.price).toBe(0);
  });

  it('drops a person who picked nothing', () => {
    const frontmatter = buildOrderFrontmatter(properties, {
      ...content,
      selections: [sel('Stefan Muster', [])],
    });
    expect(frontmatter.selections).toBeUndefined();
  });

  it('follows renamed properties', () => {
    const renamed = { ...properties, companyProperty: 'lieferant', priceProperty: 'preis' };
    const frontmatter = buildOrderFrontmatter(renamed, content);
    expect(frontmatter.lieferant).toBe('[[TomTasty AG]]');
    expect(frontmatter.preis).toBe(84.5);
  });
});

describe('parseOrder', () => {
  it('round-trips everything the writer wrote', () => {
    const parsed = read(buildOrderFrontmatter(properties, content));
    expect(parsed).toEqual({ orderNumber: '33335', ...content });
  });

  it('takes the order number from the filename, since it is nowhere else', () => {
    const parsed = read(buildOrderFrontmatter(properties, content), '2026-07-24-99');
    expect(parsed.orderNumber).toBe('99');
  });

  it('prefers the frontmatter date over the filename, so a correction sticks', () => {
    const parsed = read({ orderDate: '2026-07-25' }, '2026-07-24-33335');
    expect(parsed.orderDate).toBe('2026-07-25');
  });

  it('falls back to the filename date when the property is missing', () => {
    expect(read({}).orderDate).toBe('2026-07-24');
  });

  it('reads a date Obsidian turned into a native Date', () => {
    // An unquoted ISO-shaped value never reaches this as a string.
    const parsed = read({ deliveryDate: new Date(2026, 6, 26) });
    expect(parsed.deliveryDate).toBe('2026-07-26');
  });

  it('reads a price a hand edit left as a string', () => {
    expect(read({ price: '84.5' }).price).toBe(84.5);
    expect(read({ price: 'about eighty' }).price).toBeNull();
  });

  it('drops a selections entry naming nobody', () => {
    // It belongs to no person and could never be edited back into one.
    const parsed = read({ selections: [{ meals: ['[[Pizza]]'] }] });
    expect(parsed.selections).toEqual([]);
  });

  it('reads a v1 note through its flat per-person properties', () => {
    const parsed = read({ selectionStefan: ['[[Risotto]]', '[[Lasagne]]'] }, '2026-07-24-1', [
      'Stefan Muster',
    ]);
    expect(parsed.selections).toEqual([sel('Stefan Muster', ['Risotto', 'Lasagne'])]);
  });

  it('ignores the v1 properties once a note carries a v2 list', () => {
    // A note that has been saved once is v2, and its v1 leftovers are stale.
    const parsed = read(
      {
        selections: [{ person: '[[Ada Lovelace]]', meals: ['[[Pizza]]'] }],
        selectionStefan: ['[[Risotto]]'],
      },
      '2026-07-24-1',
      ['Stefan Muster', 'Ada Lovelace']
    );
    expect(parsed.selections).toEqual([sel('Ada Lovelace', ['Pizza'])]);
  });

  it('reproduces v1 first-word keying exactly, because that is what is on disk', () => {
    expect(legacySelectionProperty('selection', 'Stefan Muster')).toBe('selectionStefan');
    // The collision v2 exists to end: a different Stefan keys the same way.
    expect(legacySelectionProperty('selection', 'Stefan B. Jones')).toBe('selectionStefan');
  });

  it('spots a note that still needs upgrading', () => {
    expect(hasLegacySelections({ selectionStefan: [] }, 'selection', ['Stefan J'])).toBe(true);
    expect(hasLegacySelections({}, 'selection', ['Stefan J'])).toBe(false);
  });
});

describe('ordersForMeal', () => {
  const order = (id: string, mealTitles: string[]): OrderRecord =>
    ({
      file: { path: `${id}.md` },
      title: id,
      orderNumber: id,
      companyTitle: null,
      orderDate: '2026-07-24',
      deliveryDate: null,
      price: null,
      priceCurrency: null,
      selections: [sel('Stefan', mealTitles)],
    }) as OrderRecord;

  it('finds every order naming a meal, whoever picked it', () => {
    const orders = [order('a', ['Pizza']), order('b', ['Risotto']), order('c', ['pizza'])];
    expect(ordersForMeal(orders, 'Pizza').map((item) => item.orderNumber)).toEqual(['a', 'c']);
  });

  it('is empty for a meal nobody has ordered', () => {
    expect(ordersForMeal([order('a', ['Pizza'])], 'Lasagne')).toEqual([]);
  });
});
