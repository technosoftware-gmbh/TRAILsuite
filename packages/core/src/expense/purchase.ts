/**
 * A purchase note: its filename, its frontmatter, and how it is read back.
 *
 * The generic form of what CULItrail calls an order. Same claims, one real
 * difference: a line names free text rather than a meal note, because the thing
 * bought is usually not a note and must never have to become one before it can
 * be written down.
 *
 * **Every price is gross.** That is what an invoice says, and it is the same
 * claim an order note makes, so a figure means the same thing in both.
 *
 * Every property name is a setting. The shape is not: a caller may spell
 * `items` differently, not restructure it.
 *
 * App-free.
 */
import { localDateISO } from '../dates/day.js';
import { readIsoDate } from '../dates/read.js';
import { readNumberLike, readPathList, readString } from '../frontmatter/read.js';
import { linkOrText, wikilinkValue } from '../links/wikilink.js';
import { normalizeCurrency } from '../money/format.js';
import {
  adjustedTotal,
  includedVatOf,
  linesSubtotal,
  statedDisagreesWithComputed,
} from './total.js';
import { isPurchaseStatus, type ExpenseLine, type PurchaseStatus } from './types.js';
import {
  purchaseDeliveriesValue,
  readPurchaseDeliveries,
  type PurchaseDelivery,
  type PurchaseDeliveryProperties,
} from './purchase-delivery.js';

export interface PurchaseProperties extends PurchaseDeliveryProperties {
  typePropertyName: string;
  typeValue: string;
  companyProperty: string;
  areaProperty: string;
  projectProperty: string;
  categoryProperty: string;
  statusProperty: string;
  dateProperty: string;
  deliveryDateProperty: string;
  amountProperty: string;
  currencyProperty: string;
  discountProperty: string;
  shippingProperty: string;
  vatRateProperty: string;
  vatAmountProperty: string;
  itemsProperty: string;
  referenceProperty: string;
  itemNameField: string;
  itemPriceField: string;
  itemQuantityField: string;
  itemDiscountField: string;
  itemNoteField: string;
  documentProperty: string;
  billProperty: string;
}

/** One purchase, as its note states it. Titles rather than resolved notes: resolution belongs to the reader. */
export interface ParsedPurchase {
  /**
   * The vendor's own order number.
   *
   * A property now, with the filename as a fallback. It used to live in the
   * name alone, on the argument that one place cannot disagree with itself.
   * That held while the name was `yyyy-mm-dd-reference` and nothing else. Once
   * the name carries the company as well, reading a reference back out of it
   * means guessing where a company name ends, and a company with a hyphen in it
   * would quietly acquire the wrong order number.
   */
  reference: string;
  companyTitle: string | null;
  areaTitle: string | null;
  projectTitle: string | null;
  category: string | null;
  status: PurchaseStatus;
  /** ISO days. The property wins over the filename, because a person correcting the date edits the property. */
  date: string | null;
  deliveryDate: string | null;
  /** The total as somebody typed it. Never overwritten by a computed one. */
  amount: number | null;
  currency: string | null;
  discount: number | null;
  shipping: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  items: ExpenseLine[];
  /**
   * The consignments this purchase arrived in, when it came in more than one.
   *
   * Empty for a purchase that arrived in one go, or has not arrived, which is
   * every purchase written before this existed. See `purchase-delivery.ts` for
   * why they live here rather than as notes of their own, and for why the
   * status is derived from them.
   */
  deliveries: PurchaseDelivery[];
  /**
   * The paper this note is about: one file, or several.
   *
   * An invoice arrives as a covering letter and a payment slip often enough
   * that one path was not enough, and scanning a two-page invoice in two goes
   * produces the same shape. Read leniently from a bare string or a list, and
   * **written back as a bare string while there is only one**, so no note that
   * predates this is rewritten just for being read.
   *
   * Order is the note's own, because it is the only thing that says which of
   * them is the invoice.
   */
  documentPaths: string[];
  billTitle: string | null;
}

export interface PurchaseRecord<F = unknown> extends ParsedPurchase {
  file: F;
  title: string;
}

/** `yyyy-mm-dd-reference`, or just the date when no reference was given. */
export function purchaseFilenameStem(date: Date, reference: string): string {
  const stamp = localDateISO(date);
  const trimmed = reference.trim();
  return trimmed ? `${stamp}-${trimmed}` : stamp;
}

/**
 * Reverses the filename.
 *
 * Null when the name does not start with an ISO date, so a note that merely
 * happens to sit in the Purchases folder is never given a nonsense reference
 * invented from its title.
 */
export function parsePurchaseFilenameStem(
  stem: string
): { date: string; reference: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:-(.+))?$/.exec(stem.trim());
  const date = match?.[1];
  if (!date) return null;
  return { date, reference: match?.[2] ?? '' };
}

/** One line, read leniently, because a hand-edited note grows bare strings among the objects. */
function readLine(entry: unknown, properties: PurchaseProperties): ExpenseLine | null {
  if (typeof entry === 'string') {
    const name = entry.trim();
    return name ? { name, price: null, quantity: 1, discount: null, note: null } : null;
  }
  if (typeof entry !== 'object' || entry === null) return null;

  const record = entry as Record<string, unknown>;
  const name = readString(record[properties.itemNameField]);
  if (!name) return null;

  return {
    name,
    price: readNumberLike(record[properties.itemPriceField]),
    // Floored at 1: a line with a quantity of zero is a line nobody bought, and
    // reading it as free would understate the total rather than say so.
    quantity: Math.max(1, Math.round(readNumberLike(record[properties.itemQuantityField]) ?? 1)),
    discount: readNumberLike(record[properties.itemDiscountField]),
    note: readString(record[properties.itemNoteField]),
  };
}

export interface ParsePurchaseInput {
  /** The filename without its extension. */
  stem: string;
  frontmatter: Record<string, unknown>;
  properties: PurchaseProperties;
}

/**
 * An unrecognised `status:` reads as `ordered` rather than as null.
 *
 * That is what a half-typed note most likely means: something was bought. A
 * nullable status would put an "unknown" column on every sheet to describe a
 * typo, and would leave the figure in none of the totals, which is the one
 * outcome guaranteed to be wrong.
 */
export function parsePurchase(input: ParsePurchaseInput): ParsedPurchase {
  const { frontmatter, properties: p } = input;
  const fromFilename = parsePurchaseFilenameStem(input.stem);
  const rawStatus = readString(frontmatter[p.statusProperty]);
  const rawItems = frontmatter[p.itemsProperty];

  return {
    // The property wins, so a note named the new way is read correctly and one
    // named the old way still gives up its reference.
    reference: readString(frontmatter[p.referenceProperty]) ?? fromFilename?.reference ?? '',
    companyTitle: linkOrText(frontmatter[p.companyProperty]),
    areaTitle: linkOrText(frontmatter[p.areaProperty]),
    projectTitle: linkOrText(frontmatter[p.projectProperty]),
    category: readString(frontmatter[p.categoryProperty]),
    status: isPurchaseStatus(rawStatus) ? (rawStatus.trim() as PurchaseStatus) : 'ordered',
    date: readIsoDate(frontmatter[p.dateProperty]) ?? fromFilename?.date ?? null,
    deliveryDate: readIsoDate(frontmatter[p.deliveryDateProperty]),
    amount: readNumberLike(frontmatter[p.amountProperty]),
    currency: normalizeCurrency(readString(frontmatter[p.currencyProperty])),
    discount: readNumberLike(frontmatter[p.discountProperty]),
    shipping: readNumberLike(frontmatter[p.shippingProperty]),
    vatRate: readNumberLike(frontmatter[p.vatRateProperty]),
    vatAmount: readNumberLike(frontmatter[p.vatAmountProperty]),
    items: Array.isArray(rawItems)
      ? (rawItems as unknown[])
          .map((entry) => readLine(entry, p))
          .filter((line): line is ExpenseLine => line !== null)
      : [],
    deliveries: readPurchaseDeliveries(frontmatter, p),
    documentPaths: readPathList(frontmatter[p.documentProperty]),
    billTitle: linkOrText(frontmatter[p.billProperty]),
  };
}

export type PurchaseContent = ParsedPurchase;

/**
 * The frontmatter object for a purchase.
 *
 * An object rather than YAML text, so the writer hands it to the host and a
 * test can inspect it. Optional fields are omitted rather than written empty: a
 * note holding `deliveryDate:` with nothing after it says something different
 * from one that never had the property.
 */
export function buildPurchaseFrontmatter(
  properties: PurchaseProperties,
  content: PurchaseContent
): Record<string, unknown> {
  const p = properties;
  const frontmatter: Record<string, unknown> = { [p.typePropertyName]: p.typeValue };

  if (content.companyTitle) frontmatter[p.companyProperty] = wikilinkValue(content.companyTitle);
  if (content.areaTitle) frontmatter[p.areaProperty] = wikilinkValue(content.areaTitle);
  if (content.projectTitle) frontmatter[p.projectProperty] = wikilinkValue(content.projectTitle);
  if (content.category) frontmatter[p.categoryProperty] = content.category;
  frontmatter[p.statusProperty] = content.status;
  if (content.date) frontmatter[p.dateProperty] = content.date;
  if (content.deliveryDate) frontmatter[p.deliveryDateProperty] = content.deliveryDate;
  if (content.amount !== null) frontmatter[p.amountProperty] = content.amount;
  if (content.currency) frontmatter[p.currencyProperty] = content.currency;
  if ((content.discount ?? null) !== null) frontmatter[p.discountProperty] = content.discount;
  if ((content.shipping ?? null) !== null) frontmatter[p.shippingProperty] = content.shipping;
  if ((content.vatRate ?? null) !== null) frontmatter[p.vatRateProperty] = content.vatRate;
  if ((content.vatAmount ?? null) !== null) frontmatter[p.vatAmountProperty] = content.vatAmount;
  // One stays a bare string. A list of one would rewrite the frontmatter of
  // every note that has ever had a document, to say exactly what it said.
  if (content.documentPaths.length === 1) {
    frontmatter[p.documentProperty] = content.documentPaths[0];
  } else if (content.documentPaths.length > 1) {
    frontmatter[p.documentProperty] = [...content.documentPaths];
  }
  if (content.billTitle) frontmatter[p.billProperty] = wikilinkValue(content.billTitle);
  if (content.reference) frontmatter[p.referenceProperty] = content.reference;

  if (content.items.length > 0) {
    frontmatter[p.itemsProperty] = content.items.map((line) => lineValue(p, line));
  }

  // Omitted entirely when there are none, so a purchase that arrived in one go
  // carries no key -- which is every purchase written before this existed, and
  // is what keeps reading one from rewriting it.
  const deliveries = purchaseDeliveriesValue(content.deliveries, p);
  if (deliveries) frontmatter[p.deliveriesProperty] = deliveries;

  return frontmatter;
}

/** One line. Price, quantity, discount and note are omitted when they say nothing. */
function lineValue(properties: PurchaseProperties, line: ExpenseLine): Record<string, unknown> {
  const value: Record<string, unknown> = { [properties.itemNameField]: line.name };

  if (line.price !== null) value[properties.itemPriceField] = line.price;
  // 1 is the absence of a quantity rather than a quantity.
  if (line.quantity !== 1) value[properties.itemQuantityField] = line.quantity;
  if ((line.discount ?? null) !== null) value[properties.itemDiscountField] = line.discount;
  if (line.note) value[properties.itemNoteField] = line.note;
  return value;
}

/**
 * What a purchase's lines add up to, before anything the note states.
 *
 * Null unless at least one line carries a price, on exactly the terms
 * `linesSubtotal` documents: a computed 0.00 beside a stated 189.40 reads as
 * software that has lost the money.
 */
export function purchaseSubtotal(purchase: Pick<ParsedPurchase, 'items'>): number | null {
  return linesSubtotal(purchase.items);
}

/** The same with the whole-purchase discount and shipping applied. */
export function computedPurchaseTotalOf(
  purchase: Pick<ParsedPurchase, 'items' | 'discount' | 'shipping'>
): number | null {
  return adjustedTotal(purchaseSubtotal(purchase), purchase.discount, purchase.shipping);
}

/**
 * Whether the stated total disagrees with the lines.
 *
 * False when either side says nothing: a purchase with no line prices is not in
 * disagreement with itself. This is what the health check asks; it is not what
 * a budget spends, because a note is a record of what was charged and a
 * recomputation is an opinion about that record.
 */
export function purchaseTotalsDisagree(
  purchase: Pick<ParsedPurchase, 'items' | 'discount' | 'shipping' | 'amount'>
): boolean {
  return statedDisagreesWithComputed(purchase.amount, computedPurchaseTotalOf(purchase));
}

/** How much of a purchase's gross total was tax, as the note states it. */
export function purchaseIncludedVat(
  purchase: Pick<
    ParsedPurchase,
    'items' | 'discount' | 'shipping' | 'amount' | 'vatRate' | 'vatAmount'
  >
): number | null {
  return includedVatOf(
    purchase.amount ?? computedPurchaseTotalOf(purchase),
    purchase.vatRate,
    purchase.vatAmount
  );
}
