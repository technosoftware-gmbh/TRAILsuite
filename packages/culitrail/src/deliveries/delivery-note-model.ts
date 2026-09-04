/**
 * A delivery, expressed as the same invoice model an order uses.
 *
 * **The invoice without the money.** A delivery answers "what is in the freezer
 * now" where an order answers "what was charged", and those are the same
 * document minus three columns: a counterparty, a date, a table of dishes, a
 * total. Giving it a layout of its own would have meant a second set of
 * conventions for a reader to learn, and a second place for the two to drift
 * apart the next time either changes.
 *
 * It therefore carries no currency and no price column at all, rather than
 * columns of dashes: a box has no price, and a document implying one would be
 * claiming something the note does not say.
 *
 * App-free.
 */
import { t } from '../lang/I18nManager';
import { formatIsoDate } from '../meals/view-model/format-date';
import type {
  InvoiceColumns,
  InvoiceFact,
  InvoiceFooter,
  InvoiceFooterEntry,
  InvoiceLine,
  InvoiceModel,
  InvoiceTotal,
} from 'trail-core';
import type { DeliveryItem, ParsedDelivery } from './types';

/**
 * One order this delivery settles, reduced to what the document needs.
 *
 * Not an `OrderRecord`: this file has no use for the file, the selections or
 * the money, and the narrow shape is what lets a delivery naming an order note
 * that no longer exists still render, with the title it was given and no
 * supplier behind it.
 */
export interface SettledOrder {
  title: string;
  companyTitle: string | null;
}

/**
 * Who the box came from.
 *
 * Read off the orders rather than off the delivery, because a delivery note
 * records no supplier of its own: it is the orders it settles that name one.
 * Two suppliers in one box is not a case worth a layout, but it is a case worth
 * being honest about, so both names are shown rather than the first one
 * silently winning.
 */
function counterpartyFor(orders: readonly SettledOrder[]): string | null {
  const named = orders
    .map((order) => order.companyTitle?.trim())
    .filter((name): name is string => Boolean(name));

  const names = [...new Set(named)];
  return names.length === 0 ? null : names.join(', ');
}

/** When it arrived. The only fact a delivery has, and the reason it is a note. */
function factsFor(delivery: ParsedDelivery): InvoiceFact[] {
  if (!delivery.deliveryDate) return [];
  return [
    {
      label: t('deliveries.date'),
      value: formatIsoDate(delivery.deliveryDate),
      icon: 'truck',
    },
  ];
}

/**
 * Which columns the table shows.
 *
 * **The quantity column appears exactly when the portions total would otherwise
 * disagree with the number of rows.** A box of six different dishes needs no
 * column of 1s; a box holding two of one of them does, or the total underneath
 * would look like arithmetic nobody can check. Same reasoning as the order
 * document's, applied to the one number a delivery has.
 */
function columnsFor(items: readonly DeliveryItem[]): InvoiceColumns {
  const anyMultiple = items.some((item) => item.quantity > 1);

  return {
    label: t('deliveries.invoice.dish'),
    quantity: anyMultiple ? t('deliveries.invoice.quantity') : null,
    unitPrice: null,
    lineTotal: null,
  };
}

function lineFor(item: DeliveryItem): InvoiceLine {
  return {
    label: item.mealTitle,
    // By title, never by path, for the reason every wikilink in this plugin is
    // followed that way: a dish whose note has moved still opens.
    linkTarget: item.mealTitle,
    quantity: String(item.quantity),
    unitPrice: null,
    lineTotal: null,
  };
}

/**
 * How much food arrived, in portions.
 *
 * The one total a delivery has, and the only figure worth putting under the
 * table: it is what somebody counts against when the second box turns up.
 * `total` rather than `subtotal`, because nothing follows it.
 */
function totalsFor(items: readonly DeliveryItem[]): InvoiceTotal[] {
  if (items.length === 0) return [];

  const portions = items.reduce((sum, item) => sum + item.quantity, 0);
  return [{ label: t('deliveries.invoice.portions'), amount: String(portions), kind: 'total' }];
}

/**
 * The orders this box settles, grouped by the supplier that shipped them.
 *
 * Grouped rather than listed flat so the block matches the order document's
 * footer, where a label heads the entries under it. With one supplier, which is
 * the ordinary case, that is a single group and reads as a plain list.
 *
 * An order whose note could not be found still gets an entry: the delivery names
 * it, and dropping it would hide the fact that the link is broken.
 */
function footerFor(orders: readonly SettledOrder[]): InvoiceFooter | null {
  if (orders.length === 0) return null;

  const groups = new Map<string, InvoiceFooterEntry[]>();
  for (const order of orders) {
    const label = order.companyTitle ?? t('orders.noCompany');
    const entries = groups.get(label) ?? [];
    entries.push({ label: order.title, linkTarget: order.title });
    groups.set(label, entries);
  }

  return {
    heading: t('deliveries.orders'),
    groups: [...groups].map(([label, entries]) => ({ label, entries })),
  };
}

/**
 * The whole document.
 *
 * Takes a `ParsedDelivery` and the orders it settles rather than looking either
 * up, for the reason `orderInvoice` takes a `ParsedOrder`: nothing here needs a
 * vault, and the narrow types are what keep it testable without one.
 */
export function deliveryNote(
  delivery: ParsedDelivery,
  orders: readonly SettledOrder[]
): InvoiceModel {
  return {
    documentLabel: t('deliveries.invoice.document'),
    // A delivery has no number of its own. The date is its identity, and it is
    // already a fact row below.
    reference: null,
    counterparty: counterpartyFor(orders),
    facts: factsFor(delivery),
    // No money anywhere in this document, so no currency to state.
    currency: null,
    columns: columnsFor(delivery.items),
    lines: delivery.items.map(lineFor),
    totals: totalsFor(delivery.items),
    footer: footerFor(orders),
  };
}
