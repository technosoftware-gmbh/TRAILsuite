/**
 * What an order starts out saying, given who it is from.
 *
 * **A default, not a derivation.** What lands in the note is a plain number,
 * and from then on it is what was charged rather than what the terms imply. A
 * company that raises its shipping next year must not change what an order from
 * today says, for exactly the reason `OrderItem` states about prices: an order
 * note is a record of a transaction, and a record that recomputes is not one.
 *
 * That is why this returns figures rather than the invoice reading the terms
 * directly. The dialog offers them, somebody accepts or overrides them, and the
 * note keeps the answer.
 *
 * App-free.
 */
import { discountFor, shippingFor, type CompanyTerms } from '../crm/company-terms';
import type { OrderSelection } from './types';

/** Portions across every person, which is what a meal company counts. */
export function orderedMealCount(selections: readonly OrderSelection[]): number {
  return selections.reduce(
    (total, selection) =>
      total + selection.items.reduce((count, item) => count + Math.max(1, item.quantity), 0),
    0
  );
}

export interface OrderDefaults {
  /** Null when the company states none, so the field is left as it was. */
  currency: string | null;
  /** Null when the company charges no shipping at all. Zero means this order earned free delivery. */
  shipping: number | null;
  /**
   * The order-level discount in money, not in percent.
   *
   * The note holds an amount because that is what the rest of the order holds
   * and what an invoice prints, and because a percentage stored against a total
   * that later changes is two figures that disagree. Null when no rung applies
   * or when there is nothing priced to take a percentage of.
   */
  discount: number | null;
  /** The rung that produced the discount, so the dialog can say why. Zero when none did. */
  discountPercent: number;
}

/**
 * The figures a new order from this company would start with.
 *
 * `subtotal` is what the lines add up to before any of this, which the caller
 * already computes for its own totals row. Handed in rather than recomputed, so
 * the discount cannot be a percentage of a different number than the one on
 * screen.
 */
export function orderDefaults(
  terms: CompanyTerms,
  selections: readonly OrderSelection[],
  subtotal: number | null
): OrderDefaults {
  const count = orderedMealCount(selections);
  const percent = discountFor(terms.discountTiers, count);

  return {
    currency: terms.currency?.trim() || null,
    shipping: shippingFor(terms, count),
    discount: percent > 0 && subtotal !== null ? Math.round(subtotal * percent) / 100 : null,
    discountPercent: percent,
  };
}
