/**
 * A purchase that arrives in more than one box.
 *
 * A `deliveries:` list on the purchase note, one entry per consignment: the day
 * it came and the lines that were in it. Sparse -- a purchase that arrived in
 * one go, or has not arrived at all, carries no such key.
 *
 * **On the purchase rather than as notes of its own**, which is the opposite of
 * the answer `delivery/` gives for a meal order, and the difference is what the
 * two have to describe. A meal company's box can settle two orders at once, so a
 * delivery there cannot be a property of any one order without lying about it.
 * A parcel settles the order it was sent for. What a household actually wants is
 * the whole history of one purchase in the note it already opens, and a second
 * kind of note to file for every parcel is a cost paid on every purchase to
 * describe a case that does not arise.
 *
 * **The status is derived from this and no longer written.** `ordered`,
 * `delivered` and the new middle state are a fact about the lines and the
 * consignments, and a written status can only disagree with them. `returned`
 * and `cancelled` are not derivable from anything -- they are decisions -- and
 * stay in the note. See `purchaseStatusOf()`.
 *
 * Nothing here reads or writes a file, and the property names are supplied by
 * the caller, because they are settings like every other name in these notes.
 *
 * App-free.
 */
import { readIsoDate } from '../dates/read.js';
import { readNumberLike, readString } from '../frontmatter/read.js';
import { linkOrText } from '../links/wikilink.js';
import { fulfilmentOf, outstandingOf, type Counted } from '../fulfilment/outstanding.js';
import type { ExpenseLine, PurchaseStatus } from './types.js';

/** The sub-key names a consignment is written under. Settings, like every other name here. */
export interface PurchaseDeliveryProperties {
  deliveriesProperty: string;
  deliveryDateField: string;
  deliveryItemsField: string;
  deliveryItemNameField: string;
  deliveryItemQuantityField: string;
  deliveryNoteField: string;
}

/** One line in one box. */
export interface DeliveredLine {
  /** Matched against the purchase's own item names, trimmed and case-insensitively. */
  name: string;
  /** At least 1, and omitted from the note when it is 1. */
  quantity: number;
}

/** One consignment: when it came, and what was in it. */
export interface PurchaseDelivery {
  /** ISO day, or null for a box somebody recorded without one. */
  date: string | null;
  items: DeliveredLine[];
  /** A tracking number, a courier, "left with the neighbour". Free text. */
  note: string | null;
}

/**
 * One consignment, read leniently.
 *
 * An entry naming no items is kept rather than dropped: "something came on the
 * 31st" is a real thing to have written down, and dropping it would delete a
 * line somebody typed because they had not finished typing it.
 *
 * A line is read from a bare string as well as from a map, so `- Igelfutter` and
 * `- name: Igelfutter` both work. Hand-editing this list is the fallback for
 * everything the dialog does not do, and the shorter form is what somebody
 * reaches for.
 */
function readDelivery(entry: unknown, p: PurchaseDeliveryProperties): PurchaseDelivery | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const row = entry as Record<string, unknown>;
  const rawItems = row[p.deliveryItemsField];

  return {
    date: readIsoDate(row[p.deliveryDateField]),
    items: Array.isArray(rawItems)
      ? (rawItems as unknown[])
          .map((item) => readDeliveredLine(item, p))
          .filter((line): line is DeliveredLine => line !== null)
      : [],
    note: readString(row[p.deliveryNoteField]),
  };
}

function readDeliveredLine(entry: unknown, p: PurchaseDeliveryProperties): DeliveredLine | null {
  if (typeof entry === 'string') {
    const name = entry.trim();
    return name ? { name, quantity: 1 } : null;
  }
  if (typeof entry !== 'object' || entry === null) return null;

  const row = entry as Record<string, unknown>;
  // `linkOrText` so a line written as a wikilink reads as its title, matching
  // how every other reference in these notes is read.
  const name = linkOrText(row[p.deliveryItemNameField])?.trim();
  if (!name) return null;

  // A hand-typed 0 means one, the same reading the purchase's own lines get:
  // the key is omitted when it is 1, so somebody typing it at all means at
  // least one of something.
  const quantity = readNumberLike(row[p.deliveryItemQuantityField]);
  return { name, quantity: quantity === null ? 1 : Math.max(1, Math.round(quantity)) };
}

export function readPurchaseDeliveries(
  frontmatter: Record<string, unknown>,
  p: PurchaseDeliveryProperties
): PurchaseDelivery[] {
  const raw = frontmatter[p.deliveriesProperty];
  if (!Array.isArray(raw)) return [];

  return (raw as unknown[])
    .map((entry) => readDelivery(entry, p))
    .filter((delivery): delivery is PurchaseDelivery => delivery !== null);
}

/** The value to write back, or undefined when there is nothing to say. */
export function purchaseDeliveriesValue(
  deliveries: readonly PurchaseDelivery[],
  p: PurchaseDeliveryProperties
): unknown[] | undefined {
  if (deliveries.length === 0) return undefined;

  return deliveries.map((delivery) => {
    const row: Record<string, unknown> = {};
    if (delivery.date) row[p.deliveryDateField] = delivery.date;
    if (delivery.note) row[p.deliveryNoteField] = delivery.note;
    if (delivery.items.length > 0) {
      row[p.deliveryItemsField] = delivery.items.map((line) => {
        // A quantity of one is the default and is left out, so the common case
        // reads as a plain list of names.
        if (line.quantity === 1) return { [p.deliveryItemNameField]: line.name };
        return {
          [p.deliveryItemNameField]: line.name,
          [p.deliveryItemQuantityField]: line.quantity,
        };
      });
    }
    return row;
  });
}

/**
 * A purchase line as the arithmetic wants it.
 *
 * **A line with no price is still a line.** A free replacement or an included
 * accessory is a thing that has to arrive, and pricing has nothing to do with
 * whether it is in the box.
 */
const asCounted = (line: ExpenseLine): Counted => ({
  name: line.name.trim(),
  quantity: Math.max(1, line.quantity),
});

const deliveredLines = (deliveries: readonly PurchaseDelivery[]): Counted[] =>
  deliveries.flatMap((delivery) => delivery.items);

/** What has been ordered and not yet arrived. Empty when everything has. */
export function outstandingLines(
  items: readonly ExpenseLine[],
  deliveries: readonly PurchaseDelivery[]
): Counted[] {
  return outstandingOf(items.map(asCounted), deliveredLines(deliveries));
}

/**
 * The status to show, from what the note records rather than from what it says.
 *
 * **`returned` and `cancelled` win over everything.** They are decisions rather
 * than observations: a purchase that arrived in full and went back is returned,
 * and the boxes it came in do not stop being recorded. Only the ordered /
 * partly / delivered axis is derived, because only that axis is a fact about
 * the lines.
 *
 * A purchase carrying no `deliveries:` at all falls back to the written status,
 * which is what every note in a vault looked like before this existed. That is
 * the whole of the compatibility story: nothing is migrated, and a purchase
 * somebody marked `delivered` by hand goes on saying so until the day a
 * consignment is recorded against it.
 */
export function purchaseStatusOf(
  written: PurchaseStatus,
  items: readonly ExpenseLine[],
  deliveries: readonly PurchaseDelivery[]
): PurchaseStatus | 'partial' {
  if (written === 'returned' || written === 'cancelled') return written;
  if (deliveries.length === 0) return written;

  const state = fulfilmentOf(items.map(asCounted), deliveredLines(deliveries));
  if (state === 'all') return 'delivered';
  return state === 'some' ? 'partial' : 'ordered';
}
