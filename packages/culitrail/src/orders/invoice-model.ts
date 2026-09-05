/**
 * An order, expressed as the format-agnostic invoice model in `trail-core`.
 *
 * The one place CULItrail's order vocabulary meets that model. Every figure here
 * comes out of `trail-core`'s `order/total.ts`, which is the single source for
 * what an order adds up to: the compact card in the orders dashboard and this
 * document are deliberately different documents, and they agree because both
 * go through it.
 *
 * App-free.
 */
import { orderTotal } from './view-model/order-total';
import { t } from '../lang/I18nManager';
import { formatIsoDate } from '../meals/view-model/format-date';
import { formatPrice } from '../meals/view-model/format-price';
import type { CULItrailSettings } from '../settings/types';
import type {
  InvoiceColumns,
  InvoiceFact,
  InvoiceFooter,
  InvoiceLine,
  InvoiceModel,
  InvoiceTotal,
} from '@technosoftware/trail-core';
import { dishLines, selectionTitles, includedVat, type DishLine } from '@technosoftware/trail-core';
import type { ParsedOrder } from './types';

/**
 * A figure with no currency on it.
 *
 * The currency is stated once beside the total rather than in every cell, which
 * is how a printed invoice reads and what keeps the numeric columns narrow on a
 * phone. `formatPrice` is still the formatter, so "two decimals always" and the
 * null and non-finite guards are decided in one place.
 */
function amount(value: number | null): string | null {
  return formatPrice(value, '');
}

/**
 * Which optional columns the table shows.
 *
 * **Unit price and line total appear only when at least one line carries a
 * price.** All 59 orders in the vault this was built against predate line
 * prices, and a table giving them two columns of dashes beside a stated total
 * would read as a plugin that had lost the money. Same rule
 * `computedOrderTotal()` returns null for, applied to the layout.
 *
 * **Quantity appears when it says something**: alongside the prices, where it is
 * the multiplier between a unit price and a line total and its absence would
 * make the two look inconsistent, or when any dish was ordered more than once. A
 * column of 1s on an unpriced order is a column that adds nothing.
 */
function columnsFor(lines: DishLine[], priced: boolean): InvoiceColumns {
  const anyMultiple = lines.some((line) => line.count > 1);

  return {
    label: t('orders.invoice.dish'),
    quantity: priced || anyMultiple ? t('orders.invoice.quantity') : null,
    unitPrice: priced ? t('orders.invoice.unitPrice') : null,
    lineTotal: priced ? t('orders.invoice.lineTotal') : null,
  };
}

/** One row per distinct dish, however many people chose it. */
function lineFor(line: DishLine): InvoiceLine {
  return {
    label: line.mealTitle,
    // By title, never by path: that is how every wikilink in this plugin is
    // followed, and a dish whose note has moved still opens.
    linkTarget: line.mealTitle,
    quantity: String(line.count),
    unitPrice: amount(line.price),
    lineTotal: line.price === null ? null : amount(line.price * line.count),
  };
}

/**
 * The margin of the document: when it was ordered, when it came, and every
 * figure that is not the bottom line.
 *
 * **The discount, the shipping and the VAT are facts rather than totals rows.**
 * There is one total on this document and it is what was paid; a block that
 * walked from a subtotal down to it was three rows of arithmetic to say a number
 * the lines above already state. As facts they sit beside the dates, where a
 * reader looking for "was there a discount on this one" finds them without
 * reading a sum.
 *
 * `package` for shipping rather than a second `truck`, so the delivery fact and
 * the shipping fact are not the same icon in one row.
 */
/**
 * The one figure this document states.
 *
 * **An order that has line prices is totalled from them**, because the editor is
 * what wrote both and it computes the total rather than asking for it. **An
 * order that has none uses the total somebody typed**, which is every order
 * written before line prices existed and the only thing such a note knows about
 * money. There is never a third case.
 */

function factsFor(order: ParsedOrder, total: number | null): InvoiceFact[] {
  const facts: InvoiceFact[] = [];

  if (order.orderDate) {
    facts.push({
      label: t('orders.ordered'),
      value: formatIsoDate(order.orderDate),
      icon: 'calendar',
    });
  }
  if (order.deliveryDate) {
    facts.push({
      label: t('orders.delivered'),
      value: formatIsoDate(order.deliveryDate),
      icon: 'truck',
    });
  }

  if (order.discount !== null) {
    facts.push({ label: t('orders.discount'), value: order.discount.toFixed(2), icon: 'tag' });
  }
  if (order.shipping !== null) {
    facts.push({ label: t('orders.shipping'), value: order.shipping.toFixed(2), icon: 'package' });
  }

  // Last, because it is the one figure here that is already inside the total
  // rather than a step towards it: the prices above include it. Taken off the
  // total this document actually prints, so a hand-edited note whose stated
  // figure disagrees with its lines cannot show a VAT share of a number that is
  // nowhere on the page.
  const vat = includedVat({ ...order, price: total });
  if (vat !== null) {
    facts.push({
      label:
        order.vatRate === null
          ? t('orders.invoice.vatIncluded')
          : t('orders.invoice.vatIncludedAt', { rate: String(order.vatRate) }),
      value: amount(vat) ?? '',
      icon: 'percent',
    });
  }

  return facts;
}

/**
 * The bottom line, and nothing else.
 *
 * **One row, and the lines above are what explains it.** The document used to
 * carry four -- a subtotal, each adjustment, the figure computed from the lines
 * and the figure the note states -- because a note could say one thing while its
 * lines said another and there was no way to know which was right.
 *
 * That ambiguity is gone by construction: see `view-model/order-total.ts` for which figure
 * wins and why. There is never a third case, so there is never a second row.
 */
function totalsFor(total: number | null): InvoiceTotal[] {
  if (total === null) return [];

  return [{ label: t('orders.invoice.total'), amount: amount(total) ?? '', kind: 'total' }];
}

/** One group per person, their dishes in the order the note names them. */
function footerFor(order: ParsedOrder): InvoiceFooter | null {
  if (order.selections.length === 0) return null;

  return {
    heading: t('orders.whoOrderedWhat'),
    groups: order.selections.map((selection) => ({
      label: selection.personTitle,
      entries: selectionTitles(selection).map((title) => ({ label: title, linkTarget: title })),
    })),
  };
}

/**
 * The whole document.
 *
 * Takes a `ParsedOrder` rather than an `OrderRecord` because nothing here needs
 * the file: an order read straight out of a note and an order from the list both
 * render identically, and the narrower type is what keeps this testable without
 * a vault.
 */
export function orderInvoice(order: ParsedOrder, settings: CULItrailSettings): InvoiceModel {
  const lines = dishLines(order);
  const priced = lines.some((line) => line.price !== null);
  const total = orderTotal(order);

  return {
    documentLabel: t('orders.invoice.document'),
    reference: order.orderNumber ? `#${order.orderNumber}` : null,
    counterparty: order.companyTitle ?? t('orders.noCompany'),
    facts: factsFor(order, total),
    // The note's own currency wins over the default: an order is a record of a
    // transaction, and one made in another currency stays in it.
    currency: order.priceCurrency?.trim() || settings.orderDefaultCurrency.trim() || null,
    columns: columnsFor(lines, priced),
    lines: lines.map(lineFor),
    totals: totalsFor(total),
    footer: footerFor(order),
  };
}
