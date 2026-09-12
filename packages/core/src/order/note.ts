/**
 * An order note's filename and frontmatter.
 *
 * App-free, so the writer and the reader can be tested against each other by
 * round-tripping one through the other. That is worth more here than
 * anywhere else in the plugin: an order note is the only thing CULItrail
 * writes that a person is unlikely to read back in Markdown, so a mistake in
 * it would sit unnoticed.
 *
 * Every property name is a setting. The **shape** is not: selections are a
 * list of person-plus-meals entries, and the sub-keys within an entry are
 * settings only so a vault can spell them, not so it can restructure them.
 */
import { localDateISO } from '../dates/day.js';
import { readIsoDate } from '../dates/read.js';
import { readNumberLike, readString } from '../frontmatter/read.js';
import { linkOrText, linkOrTextList, wikilinkValue } from '../links/wikilink.js';
import type { OrderItem, OrderSelection, ParsedOrder } from './types.js';

/** `yyyy-mm-dd-ordernumber`, or just the date when no number was given. */
export function orderFilenameStem(orderDate: Date, orderNumber: string): string {
  const stamp = localDateISO(orderDate);
  const number = orderNumber.trim();
  return number ? `${stamp}-${number}` : stamp;
}

/**
 * Reverses the filename.
 *
 * Null when the name does not start with an ISO date, so a note that merely
 * happens to sit in the Orders folder is never given a nonsense order number
 * invented from its title.
 */
export function parseOrderFilenameStem(
  stem: string
): { orderDate: string; orderNumber: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:-(.+))?$/.exec(stem.trim());
  // The date group is not optional in the pattern, so a match always has one.
  // Spelled out rather than asserted, because this package compiles with
  // `noUncheckedIndexedAccess` and an assertion is a claim a reader has to
  // verify against the regex to trust.
  const orderDate = match?.[1];
  if (!orderDate) return null;
  return { orderDate, orderNumber: match?.[2] ?? '' };
}

/**
 * The v1 per-person property name, for reading only.
 *
 * v1 wrote one flat property per person, keyed by first name:
 * `selectionStefan`. Two people sharing a first name therefore shared a
 * property, and one person's picks were read back as the other's. That is
 * why v2 exists. This is kept so notes written before the change still parse
 * and are upgraded the next time they are saved, and it reproduces v1's
 * first-word rule exactly, because a migration has to match what is actually
 * on disk rather than what the rule should have been.
 */
export function legacySelectionProperty(prefix: string, personTitle: string): string {
  const firstWord = personTitle.trim().split(/\s+/)[0] ?? '';
  return `${prefix}${firstWord}`;
}

export interface OrderProperties {
  typePropertyName: string;
  typeValue: string;
  companyProperty: string;
  orderDateProperty: string;
  deliveryDateProperty: string;
  priceProperty: string;
  priceCurrencyProperty: string;
  selectionsProperty: string;
  selectionPersonField: string;
  selectionMealsField: string;
  /** v3: the priced list that replaces `selectionMealsField` once a line has a price. */
  selectionItemsField: string;
  itemMealField: string;
  itemPriceField: string;
  itemQuantityField: string;
  itemDiscountField: string;
  discountProperty: string;
  shippingProperty: string;
  vatRateProperty: string;
  vatAmountProperty: string;
}

export interface OrderContent {
  companyTitle: string | null;
  /** ISO dates. Written as strings so Obsidian's YAML parser leaves them alone. */
  orderDate: string | null;
  deliveryDate: string | null;
  price: number | null;
  priceCurrency: string | null;
  discount: number | null;
  shipping: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  selections: OrderSelection[];
}

/**
 * The frontmatter object for an order.
 *
 * An object rather than YAML text, so the writer can hand it to Obsidian and
 * a test can inspect it. Optional fields are omitted rather than written
 * empty: a note holding `deliveryDate:` with nothing after it says something
 * different from one that never had the property.
 */
export function buildOrderFrontmatter(
  properties: OrderProperties,
  content: OrderContent
): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {
    [properties.typePropertyName]: properties.typeValue,
  };

  if (content.companyTitle) {
    frontmatter[properties.companyProperty] = wikilinkValue(content.companyTitle);
  }
  if (content.orderDate) frontmatter[properties.orderDateProperty] = content.orderDate;
  if (content.deliveryDate) frontmatter[properties.deliveryDateProperty] = content.deliveryDate;
  if (content.price !== null) frontmatter[properties.priceProperty] = content.price;
  if (content.priceCurrency) {
    frontmatter[properties.priceCurrencyProperty] = content.priceCurrency;
  }
  if (content.discount !== null) frontmatter[properties.discountProperty] = content.discount;
  if (content.shipping !== null) frontmatter[properties.shippingProperty] = content.shipping;
  // `?? null` for the same reason `priced()` uses it: an absent field and a
  // null one both mean the note says nothing, and writing `undefined` into
  // frontmatter would put a `vatRate:` with nothing after it into the note.
  if ((content.vatRate ?? null) !== null) {
    frontmatter[properties.vatRateProperty] = content.vatRate;
  }
  if ((content.vatAmount ?? null) !== null) {
    frontmatter[properties.vatAmountProperty] = content.vatAmount;
  }

  // A person who picked nothing gets no entry, so an order everybody skipped
  // carries no selections property at all rather than a list of empty rows.
  const withItems = content.selections.filter((selection) => selection.items.length > 0);
  const selections = withItems.map((selection) =>
    priced(content)
      ? {
          [properties.selectionPersonField]: wikilinkValue(selection.personTitle),
          [properties.selectionItemsField]: selection.items.map((item) =>
            itemValue(properties, item)
          ),
        }
      : {
          [properties.selectionPersonField]: wikilinkValue(selection.personTitle),
          [properties.selectionMealsField]: selection.items.map((item) =>
            wikilinkValue(item.mealTitle)
          ),
        }
  );

  if (selections.length > 0) frontmatter[properties.selectionsProperty] = selections;
  return frontmatter;
}

/**
 * Whether this order has anything a v2 note could not hold.
 *
 * **An order with no prices and no quantities stays v2 on save**, which is what
 * keeps 59 existing notes from being rewritten into a shape that says nothing new
 * about them. The schema is decided per note rather than per selection, so one
 * note never carries a priced list for one person and a bare list for another.
 */
function priced(content: OrderContent): boolean {
  // `?? null` rather than a bare `!== null` on each: a hand-built item can omit
  // an optional-looking field entirely, and `undefined !== null` would then read
  // as a claim and push all 59 existing notes into the v3 shape on their next
  // save. Absent and null mean the same thing here.
  return content.selections.some((selection) =>
    selection.items.some(
      (item) =>
        (item.price ?? null) !== null ||
        (item.quantity ?? 1) !== 1 ||
        (item.discount ?? null) !== null
    )
  );
}

/** One v3 line. Price and quantity are omitted when they say nothing. */
function itemValue(properties: OrderProperties, item: OrderItem): Record<string, unknown> {
  const value: Record<string, unknown> = {
    [properties.itemMealField]: wikilinkValue(item.mealTitle),
  };
  if (item.price !== null) value[properties.itemPriceField] = item.price;
  // 1 is the absence of a quantity rather than a quantity, the same way a
  // multiplier of 1 is removed from a meal rather than written.
  if (item.quantity !== 1) value[properties.itemQuantityField] = item.quantity;
  if ((item.discount ?? null) !== null) value[properties.itemDiscountField] = item.discount;
  return value;
}

/** The v2 selections list, or null when the note does not carry one. */
function readSelections(
  frontmatter: Record<string, unknown>,
  properties: OrderProperties
): OrderSelection[] | null {
  const raw = frontmatter[properties.selectionsProperty];
  if (!Array.isArray(raw)) return null;

  const selections: OrderSelection[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;

    const record = entry as Record<string, unknown>;
    const personTitle = linkOrText(record[properties.selectionPersonField]);
    // An entry naming nobody is dropped rather than kept under an empty
    // name: it belongs to no person and could never be edited back into one.
    if (!personTitle) continue;

    selections.push({ personTitle, items: readItems(record, properties) });
  }

  return selections;
}

/**
 * One selection's lines, from either schema.
 *
 * v3's priced list wins when it is there; otherwise the bare v2 list is read as
 * lines with no price and a quantity of one. A v2 note therefore parses into the
 * same model as a v3 one, and every reader above this point stops caring which it
 * was looking at.
 */
function readItems(record: Record<string, unknown>, properties: OrderProperties): OrderItem[] {
  const raw = record[properties.selectionItemsField];

  if (Array.isArray(raw)) {
    const items: OrderItem[] = [];
    for (const entry of raw) {
      // A bare wikilink among the objects, which is what a hand-edited note is
      // likely to grow. Read as a line with no price rather than dropped.
      if (typeof entry === 'string') {
        const title = linkOrText(entry);
        if (title) items.push({ mealTitle: title, price: null, quantity: 1, discount: null });
        continue;
      }
      if (typeof entry !== 'object' || entry === null) continue;

      const line = entry as Record<string, unknown>;
      const title = linkOrText(line[properties.itemMealField]);
      if (!title) continue;

      items.push({
        mealTitle: title,
        price: readNumberLike(line[properties.itemPriceField]),
        // Floored at 1: a line with a quantity of zero is a line nobody ordered,
        // and reading it as free would understate the total rather than say so.
        quantity: Math.max(1, Math.round(readNumberLike(line[properties.itemQuantityField]) ?? 1)),
        discount: readNumberLike(line[properties.itemDiscountField]),
      });
    }
    return items;
  }

  return linkOrTextList(record[properties.selectionMealsField]).map((title) => ({
    mealTitle: title,
    price: null,
    quantity: 1,
    discount: null,
  }));
}

/**
 * The v1 flat properties, best effort.
 *
 * Best effort because v1's keying is ambiguous by construction: two people
 * sharing a first name share a property, and this cannot tell which of them
 * it meant. It reads the same meals back for both, which is the bug v2
 * exists to end. Saving the note once upgrades it and the ambiguity is gone
 * for that note permanently.
 */
function readLegacySelections(
  frontmatter: Record<string, unknown>,
  prefix: string,
  personTitles: string[]
): OrderSelection[] {
  return personTitles
    .map((personTitle) => ({
      personTitle,
      items: linkOrTextList(frontmatter[legacySelectionProperty(prefix, personTitle)]).map(
        (mealTitle) => ({ mealTitle, price: null, quantity: 1, discount: null })
      ),
    }))
    .filter((selection) => selection.items.length > 0);
}

export interface ParseOrderInput {
  /** The filename without its extension. */
  stem: string;
  frontmatter: Record<string, unknown>;
  properties: OrderProperties;
  /** v1's prefix. Only consulted when the note carries no v2 list. */
  legacyPrefix: string;
  /** Who to look for v1 properties for. A v2 note names its own people and needs none of this. */
  personTitles: string[];
}

export function parseOrder(input: ParseOrderInput): ParsedOrder {
  const { frontmatter, properties } = input;
  const fromFilename = parseOrderFilenameStem(input.stem);

  return {
    orderNumber: fromFilename?.orderNumber ?? '',
    companyTitle: linkOrText(frontmatter[properties.companyProperty]),
    // Frontmatter first: the filename is fixed once written, and a person
    // correcting the date edits the property.
    orderDate:
      readIsoDate(frontmatter[properties.orderDateProperty]) ?? fromFilename?.orderDate ?? null,
    // Through the date reader rather than read as a string, because an
    // unquoted ISO-shaped value is turned into a native Date by Obsidian's
    // YAML parser before anything here sees it.
    deliveryDate: readIsoDate(frontmatter[properties.deliveryDateProperty]),
    price: readNumberLike(frontmatter[properties.priceProperty]),
    priceCurrency: readString(frontmatter[properties.priceCurrencyProperty]),
    discount: readNumberLike(frontmatter[properties.discountProperty]),
    shipping: readNumberLike(frontmatter[properties.shippingProperty]),
    vatRate: readNumberLike(frontmatter[properties.vatRateProperty]),
    vatAmount: readNumberLike(frontmatter[properties.vatAmountProperty]),
    selections:
      readSelections(frontmatter, properties) ??
      readLegacySelections(frontmatter, input.legacyPrefix, input.personTitles),
  };
}

/** True when a note still carries v1 properties, so a save can clean them off. */
export function hasLegacySelections(
  frontmatter: Record<string, unknown>,
  prefix: string,
  personTitles: string[]
): boolean {
  return personTitles.some(
    (title) => frontmatter[legacySelectionProperty(prefix, title)] !== undefined
  );
}
