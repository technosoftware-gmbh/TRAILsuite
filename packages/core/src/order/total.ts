/**
 * What an order's lines add up to.
 *
 * Separate from the note reader so the arithmetic can be tested without a
 * frontmatter object, and separate from the views so two of them cannot disagree
 * about the same order.
 *
 * App-free.
 */
import {
  adjustedTotal,
  includedVatOf,
  lineTotal,
  linesSubtotal,
  statedDisagreesWithComputed,
} from '../expense/total.js';
import type { OrderItem, OrderSelection, ParsedOrder } from './types.js';

/** The meal titles in one selection, for a caller that does not care what they cost. */
export function selectionTitles(selection: OrderSelection): string[] {
  return selection.items.map((item) => item.mealTitle);
}

/** Every meal title in an order, in the order the note lists them. */
export function orderTitles(order: Pick<ParsedOrder, 'selections'>): string[] {
  return order.selections.flatMap(selectionTitles);
}

/**
 * One dish in an order, however many people chose it.
 *
 * **A price belongs to the dish, not to the person who ordered it.** Two people
 * picking the same meal pay the same for it, so the editor offers one price per
 * dish and `count` is how many portions the order contained in total. The note
 * still stores the price on each line, which is what keeps an order a record of
 * what was charged; this is the shape that view of it is edited through.
 *
 * `price` is the first one found rather than an average or a sum. A hand-edited
 * note whose two lines disagree is reported as its first line's price and is left
 * alone unless somebody edits that dish, so nothing is silently normalised: the
 * total keeps summing the lines as written.
 */
export interface DishLine {
  mealTitle: string;
  price: number | null;
  /** Portions across every person, so a dish two people chose counts twice. */
  count: number;
}

/** One entry per distinct dish, in the order the note first names it. */
export function dishLines(order: Pick<ParsedOrder, 'selections'>): DishLine[] {
  const byTitle = new Map<string, DishLine>();

  for (const selection of order.selections) {
    for (const item of selection.items) {
      const seen = byTitle.get(item.mealTitle);
      const quantity = Math.max(1, item.quantity);

      if (!seen) {
        byTitle.set(item.mealTitle, {
          mealTitle: item.mealTitle,
          price: item.price,
          count: quantity,
        });
        continue;
      }

      seen.count += quantity;
      seen.price = seen.price ?? item.price;
    }
  }

  return [...byTitle.values()];
}

/**
 * Sets one dish's price on every line that names it.
 *
 * Mutates in place, because the caller is a dialog holding a draft it is about to
 * write. Called only when somebody edits that dish's price, so a note whose lines
 * already disagree is not quietly repaired on open.
 */
export function applyDishPrice(
  order: Pick<ParsedOrder, 'selections'>,
  mealTitle: string,
  price: number | null
): void {
  for (const selection of order.selections) {
    for (const item of selection.items) {
      if (item.mealTitle === mealTitle) item.price = price;
    }
  }
}

/**
 * One line's contribution: what it cost, times how many, less its own discount.
 *
 * The discount is a percentage off this line only. It is applied here rather
 * than alongside the order-level one because it is part of what the line cost:
 * a subtotal that ignored it and an order-level adjustment that tried to make
 * up the difference would both be wrong about which dish was cheap.
 *
 * Clamped to nothing below zero. A hand-typed 120% is a typo, and a line worth
 * minus four francs would quietly reduce the rest of the order.
 */
export function itemTotal(item: OrderItem): number | null {
  return lineTotal(item);
}

/**
 * What the lines add up to before the order-level discount and shipping, or null.
 *
 * **Null unless at least one line carries a price**, on exactly the terms
 * `computedOrderTotal()` documents below. Separate from it because an invoice
 * shows the sum of the lines and the adjustments to it as different rows, and a
 * second sum written where that document is built is a second opinion about the
 * same order.
 */
export function orderSubtotal(order: Pick<ParsedOrder, 'selections'>): number | null {
  return linesSubtotal(order.selections.flatMap((selection) => selection.items));
}

/**
 * The total the lines imply, or null.
 *
 * **Null unless at least one line carries a price**, and that rule is the whole
 * reason this returns a nullable. Counted in the vault this has to work in: all 59
 * order notes predate line prices, so a version that summed an empty list would
 * show every one of them a computed 0.00 next to a stated 89.40 and read as a
 * plugin that had lost the money. A computed total is an opinion about a note that
 * holds the data for one, not a default state.
 *
 * Discount and shipping apply to the whole order rather than to any line: sum
 * the lines, take the discount off, add the shipping. They are only applied
 * when there is a sum to apply them to, for the same reason. A line may carry a
 * discount of its own, and that one is already inside the subtotal, because it
 * is part of what that line cost rather than an adjustment to the order.
 */
export function computedOrderTotal(
  order: Pick<ParsedOrder, 'selections' | 'discount' | 'shipping'>
): number | null {
  return adjustedTotal(orderSubtotal(order), order.discount, order.shipping);
}

/**
 * Whether the computed total disagrees with the one somebody typed.
 *
 * False when either is missing: an order with no line prices is not in
 * disagreement with itself, it simply has nothing to compare. A cent of tolerance,
 * because the two can differ by rounding without anybody having made a mistake.
 */
export function totalsDisagree(
  order: Pick<ParsedOrder, 'selections' | 'discount' | 'shipping' | 'price'>
): boolean {
  return statedDisagreesWithComputed(order.price, computedOrderTotal(order));
}

/**
 * How much of a gross total was tax.
 *
 * **Prices are gross, so this is carved out of the total rather than added to
 * it.** A stated amount wins over a rate: an invoice that names the francs is
 * telling you what it actually charged, and recomputing that from a percentage
 * would produce a figure a cent away from the paper for no gain.
 *
 * Null when the order states neither, which is every order written before this
 * existed and every one from a company that does not break the tax out.
 */
export function includedVat(
  order: Pick<
    ParsedOrder,
    'selections' | 'discount' | 'shipping' | 'price' | 'vatRate' | 'vatAmount'
  >
): number | null {
  return includedVatOf(order.price ?? computedOrderTotal(order), order.vatRate, order.vatAmount);
}
