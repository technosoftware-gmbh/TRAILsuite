/**
 * The order arithmetic, and the v3 schema it needs.
 *
 * Three things were confirmed about this in the user's own words, and every case
 * here exists to hold one of them:
 *
 * - A dish price is the **default** offered when a meal is added, and it changes.
 * - **An order does not change afterwards** when that default changes.
 * - The **discount is on the total**, not on any one line.
 *
 * The second is the one a test can actually protect, and it protects it by proving
 * the price lives in the order note rather than being looked up.
 */
import { describe, expect, it } from 'vitest';
import { present } from '../testing.js';
import { buildOrderFrontmatter, parseOrder, type OrderProperties } from '../../src/index.js';
import {
  applyDishPrice,
  computedOrderTotal,
  dishLines,
  itemTotal,
  orderTitles,
  totalsDisagree,
} from '../../src/index.js';
import type { OrderItem, OrderSelection, ParsedOrder } from '../../src/order/types.js';

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
  price: number | null = null,
  quantity = 1,
  discount: number | null = null
): OrderItem => ({
  mealTitle,
  price,
  quantity,
  discount,
});

const sel = (personTitle: string, items: OrderItem[]): OrderSelection => ({ personTitle, items });

const order = (over: Partial<ParsedOrder> = {}): ParsedOrder => ({
  orderNumber: '33344',
  companyTitle: 'TomTasty AG',
  orderDate: '2026-08-07',
  deliveryDate: null,
  price: null,
  priceCurrency: 'CHF',
  discount: null,
  shipping: null,
  vatRate: null,
  vatAmount: null,
  selections: [],
  ...over,
});

describe('what the lines add up to', () => {
  it('sums the priced lines', () => {
    const total = computedOrderTotal(
      order({ selections: [sel('Stefan', [item('Tom Yum Gai', 17.5), item('Pizza', 21.9)])] })
    );
    expect(total).toBe(39.4);
  });

  it('multiplies a line by its quantity', () => {
    expect(itemTotal(item('Pizza', 21.9, 3))).toBeCloseTo(65.7, 2);
  });

  it('takes the discount off the total and adds the shipping to it', () => {
    // Confirmed in those words: the discount is for the total. So it is applied
    // once, after the lines are summed, rather than spread across them.
    const total = computedOrderTotal(
      order({
        selections: [sel('Stefan', [item('A', 20), item('B', 30)])],
        discount: 5,
        shipping: 7.9,
      })
    );
    expect(total).toBe(52.9);
  });

  it('rounds to the cent, because a total is money rather than a measurement', () => {
    // 0.1 + 0.2 territory: three lines of 19.90 sum to 59.70000000000001.
    const total = computedOrderTotal(
      order({ selections: [sel('T', [item('A', 19.9), item('B', 19.9), item('C', 19.9)])] })
    );
    expect(total).toBe(59.7);
  });

  it('is null when no line carries a price, however much else the order states', () => {
    // The rule that matters most on a real vault: all 59 order notes there predate
    // line prices, and a version that summed an empty list would show every one of
    // them a computed 0.00 beside a stated 89.40.
    const untouched = order({
      price: 89.4,
      discount: 5,
      shipping: 7.9,
      selections: [sel('Stefan', [item('Tom Yum Gai'), item('Pizza')])],
    });

    expect(computedOrderTotal(untouched)).toBeNull();
    expect(totalsDisagree(untouched)).toBe(false);
  });

  it('counts a line priced at zero, which is a real price', () => {
    const total = computedOrderTotal(
      order({ selections: [sel('T', [item('Replacement', 0), item('Pizza', 21.9)])] })
    );
    expect(total).toBe(21.9);
  });
});

describe('the two totals side by side', () => {
  const priced = (price: number | null) =>
    order({ price, selections: [sel('T', [item('A', 20), item('B', 30)])] });

  it('agrees when they agree, within a cent of rounding', () => {
    expect(totalsDisagree(priced(50))).toBe(false);
    expect(totalsDisagree(priced(50.004))).toBe(false);
  });

  it('disagrees when the stated total is not what the lines say', () => {
    // The whole point of showing both: a mismatch is either a typo or a discount
    // nobody recorded, and both are worth seeing.
    expect(totalsDisagree(priced(61))).toBe(true);
  });

  it('is not in disagreement with itself when nothing was typed', () => {
    expect(totalsDisagree(priced(null))).toBe(false);
  });
});

describe('the note format', () => {
  const content = (selections: OrderSelection[], over: Record<string, unknown> = {}) => ({
    companyTitle: 'TomTasty AG',
    orderDate: '2026-08-07',
    deliveryDate: null,
    price: 89.4,
    priceCurrency: 'CHF',
    discount: null,
    shipping: null,
    vatRate: null,
    vatAmount: null,
    selections,
    ...over,
  });

  const read = (frontmatter: Record<string, unknown>) =>
    parseOrder({
      stem: '2026-08-07-33344',
      frontmatter,
      properties,
      legacyPrefix: 'selection',
      personTitles: [],
    });

  it('stays in the v2 shape when no line has a price or a quantity', () => {
    // 59 notes in the real vault look like this. Rewriting them into a priced shape
    // that says nothing new about them would be churn, and the reader treats the
    // two identically anyway.
    const written = buildOrderFrontmatter(properties, content([sel('Stefan', [item('Pizza')])]));
    const selections = written.selections as Record<string, unknown>[];

    expect(selections[0]).toEqual({ person: '[[Stefan]]', meals: ['[[Pizza]]'] });
    expect(selections[0]).not.toHaveProperty('items');
  });

  it('writes the priced shape as soon as one line has a price', () => {
    const written = buildOrderFrontmatter(
      properties,
      content([sel('Stefan', [item('Tom Yum Gai', 17.5), item('Pizza')])])
    );
    const selections = written.selections as Record<string, unknown>[];

    expect(selections[0]).toEqual({
      person: '[[Stefan]]',
      // The unpriced line keeps its place and simply states no price, rather than
      // being dropped or given a zero.
      items: [{ meal: '[[Tom Yum Gai]]', price: 17.5 }, { meal: '[[Pizza]]' }],
    });
  });

  it('writes the priced shape for a quantity alone, with no price anywhere', () => {
    const written = buildOrderFrontmatter(
      properties,
      content([sel('Stefan', [item('Pizza', null, 2)])])
    );
    const selections = written.selections as Record<string, unknown>[];
    expect(present(selections[0], 'selections[0]').items).toEqual([
      { meal: '[[Pizza]]', quantity: 2 },
    ]);
  });

  it('omits a quantity of one, since a default written out says nothing', () => {
    const written = buildOrderFrontmatter(
      properties,
      content([sel('Stefan', [item('Pizza', 21.9, 1)])])
    );
    const items = present(
      (written.selections as Record<string, unknown>[])[0],
      'the first selection'
    ).items;
    expect(items).toEqual([{ meal: '[[Pizza]]', price: 21.9 }]);
  });

  it('uses one shape for the whole note rather than mixing them per person', () => {
    const written = buildOrderFrontmatter(
      properties,
      content([sel('Stefan', [item('A', 20)]), sel('Erika', [item('B')])])
    );
    for (const selection of written.selections as Record<string, unknown>[]) {
      expect(selection).toHaveProperty('items');
    }
  });

  it('round-trips a priced order through the writer and the reader', () => {
    const before = content([sel('Stefan', [item('Tom Yum Gai', 17.5, 2), item('Pizza', 21.9)])], {
      discount: 5,
      shipping: 7.9,
    });

    const after = read(buildOrderFrontmatter(properties, before));

    expect(after.selections).toEqual(before.selections);
    expect(after.discount).toBe(5);
    expect(after.shipping).toBe(7.9);
    expect(computedOrderTotal(after)).toBeCloseTo(17.5 * 2 + 21.9 - 5 + 7.9, 2);
  });

  it('reads a v2 note as lines with no price, so nothing has to be migrated', () => {
    const after = read({
      type: 'order',
      selections: [{ person: '[[Stefan]]', meals: ['[[Pizza]]', '[[Risotto]]'] }],
    });

    expect(orderTitles(after)).toEqual(['Pizza', 'Risotto']);
    expect(
      present(after.selections[0], 'after.selections[0]').items.every((line) => line.price === null)
    ).toBe(true);
    expect(computedOrderTotal(after)).toBeNull();
  });

  it('reads a bare wikilink sitting among the priced lines', () => {
    // What a hand-edited note grows. Read as a line with no price rather than
    // dropped, because editing a note by hand is always safe here.
    const after = read({
      type: 'order',
      selections: [
        { person: '[[Stefan]]', items: ['[[Pizza]]', { meal: '[[Risotto]]', price: 12 }] },
      ],
    });

    expect(orderTitles(after)).toEqual(['Pizza', 'Risotto']);
    expect(computedOrderTotal(after)).toBe(12);
  });

  it('floors a quantity of zero at one rather than reading the line as free', () => {
    const after = read({
      type: 'order',
      selections: [
        { person: '[[Stefan]]', items: [{ meal: '[[Pizza]]', price: 10, quantity: 0 }] },
      ],
    });

    expect(present(after.selections[0], 'after.selections[0]').items[0]?.quantity).toBe(1);
    expect(computedOrderTotal(after)).toBe(10);
  });

  it('keeps a stored line price even when the dish would now cost something else', () => {
    // The confirmation this whole phase rests on. Nothing in the reader consults a
    // meal note, so there is no path by which a price rise could reach an order
    // that has already been recorded. Asserted by reading an order with no meal
    // notes in sight at all.
    const after = read({
      type: 'order',
      selections: [{ person: '[[Stefan]]', items: [{ meal: '[[Tom Yum Gai]]', price: 17.5 }] }],
    });

    expect(present(after.selections[0], 'after.selections[0]').items[0]?.price).toBe(17.5);
  });
});

describe('one price per dish, not per person', () => {
  it('groups two people ordering the same dish into one line', () => {
    // The correction that produced this: a price belongs to the meal. Two people
    // choosing it pay the same, so the editor must not offer two prices to
    // disagree with each other.
    const grouped = dishLines(
      order({
        selections: [
          sel('Stefan', [item('Beef Stroganoff', 21.9), item('Tom Yum Gai', 17.5)]),
          sel('Erika', [item('Beef Stroganoff', 21.9)]),
        ],
      })
    );

    expect(grouped.map((dish) => dish.mealTitle)).toEqual(['Beef Stroganoff', 'Tom Yum Gai']);
    expect(present(grouped[0], 'grouped[0]').count).toBe(2);
    expect(present(grouped[0], 'grouped[0]').price).toBe(21.9);
  });

  it('counts portions rather than people, so a quantity of two counts twice', () => {
    const grouped = dishLines(order({ selections: [sel('Stefan', [item('Pizza', 10, 2)])] }));
    expect(present(grouped[0], 'grouped[0]').count).toBe(2);
  });

  it('still totals both portions, which is what makes the count honest', () => {
    const both = order({
      selections: [
        sel('Stefan', [item('Stroganoff', 21.9)]),
        sel('Erika', [item('Stroganoff', 21.9)]),
      ],
    });

    expect(present(dishLines(both)[0], 'dishLines(both)[0]').count).toBe(2);
    expect(computedOrderTotal(both)).toBeCloseTo(43.8, 2);
  });

  it('sets a price on every line of that dish at once', () => {
    const twoPeople = order({
      selections: [
        sel('Stefan', [item('Stroganoff'), item('Pizza')]),
        sel('Erika', [item('Stroganoff')]),
      ],
    });

    applyDishPrice(twoPeople, 'Stroganoff', 21.9);

    expect(
      present(twoPeople.selections[0], 'twoPeople.selections[0]').items.map((line) => line.price)
    ).toEqual([21.9, null]);
    expect(present(twoPeople.selections[1], 'twoPeople.selections[1]').items[0]?.price).toBe(21.9);
    expect(computedOrderTotal(twoPeople)).toBeCloseTo(43.8, 2);
  });

  it('clears a dish across every line when its price is emptied', () => {
    const twoPeople = order({
      selections: [sel('T', [item('Stroganoff', 21.9)]), sel('E', [item('Stroganoff', 21.9)])],
    });

    applyDishPrice(twoPeople, 'Stroganoff', null);
    expect(computedOrderTotal(twoPeople)).toBeNull();
  });

  it('reports the first price of a hand-edited note whose lines disagree, and changes nothing', () => {
    // Reading must not normalise. The total keeps summing the lines as written, so a
    // note somebody edited by hand says what it says until that dish is edited here.
    const disagreeing = order({
      selections: [sel('T', [item('Stroganoff', 21.9)]), sel('E', [item('Stroganoff', 19.9)])],
    });

    expect(present(dishLines(disagreeing)[0], 'dishLines(disagreeing)[0]').price).toBe(21.9);
    expect(computedOrderTotal(disagreeing)).toBeCloseTo(41.8, 2);
  });
});
