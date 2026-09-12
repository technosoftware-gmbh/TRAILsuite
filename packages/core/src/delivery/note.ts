/**
 * The delivery note format: the pure half, with no vault behind it.
 *
 * Shaped like `orders/order-note.ts` on purpose, down to the property-names
 * object and the build/parse pair, because the two notes answer neighbouring
 * questions and a reader who has understood one should not have to learn a
 * second set of conventions for the other.
 *
 * App-free.
 */
import { readIsoDate } from '../dates/read.js';
import { readNumberLike } from '../frontmatter/read.js';
import { linkOrText, linkOrTextList, wikilinkValue } from '../links/wikilink.js';
import type { DeliveryItem, ParsedDelivery } from './types.js';

/** Every frontmatter key this module reads or writes, resolved from settings once. */
export interface DeliveryProperties {
  typePropertyName: string;
  typeValue: string;
  deliveryDateProperty: string;
  ordersProperty: string;
  itemsProperty: string;
  itemMealField: string;
  itemQuantityField: string;
}

export interface DeliveryContent {
  deliveryDate: string | null;
  orderTitles: string[];
  items: DeliveryItem[];
}

/**
 * `yyyy-mm-dd` plus a suffix when two boxes arrive on one day.
 *
 * The date alone is the common case and the suffix is the exception, which is
 * the same shape an order filename takes: an order number is usually there and
 * the name still works without one.
 */
export function deliveryFilenameStem(deliveryDate: string, suffix = ''): string {
  const trimmed = suffix.trim();
  return trimmed ? `${deliveryDate}-${trimmed}` : deliveryDate;
}

/** Reverses the filename, or null when the name does not start with an ISO date. */
export function parseDeliveryFilenameStem(stem: string): { deliveryDate: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:-.+)?$/.exec(stem.trim());
  const deliveryDate = match?.[1];
  return deliveryDate ? { deliveryDate } : null;
}

/** One line. The quantity is omitted when it is 1, the way an order line omits it. */
function itemValue(properties: DeliveryProperties, item: DeliveryItem): Record<string, unknown> {
  const value: Record<string, unknown> = {
    [properties.itemMealField]: wikilinkValue(item.mealTitle),
  };
  if (item.quantity !== 1) value[properties.itemQuantityField] = item.quantity;
  return value;
}

export function buildDeliveryFrontmatter(
  properties: DeliveryProperties,
  content: DeliveryContent
): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {
    [properties.typePropertyName]: properties.typeValue,
  };

  if (content.deliveryDate) frontmatter[properties.deliveryDateProperty] = content.deliveryDate;
  if (content.orderTitles.length > 0) {
    frontmatter[properties.ordersProperty] = content.orderTitles.map(wikilinkValue);
  }
  if (content.items.length > 0) {
    frontmatter[properties.itemsProperty] = content.items.map((item) =>
      itemValue(properties, item)
    );
  }

  return frontmatter;
}

/**
 * What arrived, from the items list.
 *
 * A bare wikilink is accepted alongside a mapping, because a box of six
 * different dishes is quicker to type as a plain list and a quantity is the
 * exception rather than the rule.
 */
function readItems(
  frontmatter: Record<string, unknown>,
  properties: DeliveryProperties
): DeliveryItem[] {
  const raw = frontmatter[properties.itemsProperty];
  if (!Array.isArray(raw)) return [];

  const items: DeliveryItem[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const title = linkOrText(entry);
      if (title) items.push({ mealTitle: title, quantity: 1 });
      continue;
    }
    if (typeof entry !== 'object' || entry === null) continue;

    const line = entry as Record<string, unknown>;
    const title = linkOrText(line[properties.itemMealField]);
    if (!title) continue;

    items.push({
      mealTitle: title,
      // Floored at 1, the way an order line is: a line with a quantity of zero
      // is a line nothing arrived for, and reading it as none would say the box
      // held something it did not.
      quantity: Math.max(1, Math.round(readNumberLike(line[properties.itemQuantityField]) ?? 1)),
    });
  }
  return items;
}

export interface ParseDeliveryInput {
  /** The filename without its extension. */
  stem: string;
  frontmatter: Record<string, unknown>;
  properties: DeliveryProperties;
}

export function parseDelivery(input: ParseDeliveryInput): ParsedDelivery {
  const { frontmatter, properties } = input;

  return {
    // Frontmatter first: the filename is fixed once written, and a person
    // correcting the date edits the property.
    deliveryDate:
      readIsoDate(frontmatter[properties.deliveryDateProperty]) ??
      parseDeliveryFilenameStem(input.stem)?.deliveryDate ??
      null,
    orderTitles: linkOrTextList(frontmatter[properties.ordersProperty]),
    items: readItems(frontmatter, properties),
  };
}

/** Every meal title in a delivery, in the order the note lists them. */
export function deliveryTitles(delivery: Pick<ParsedDelivery, 'items'>): string[] {
  return delivery.items.map((item) => item.mealTitle);
}
