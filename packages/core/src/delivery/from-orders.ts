/**
 * What a delivery would say, given the orders it settles.
 *
 * **A suggestion, not a derivation.** What the note ends up holding is what
 * somebody confirmed arrived, for the same reason an order note holds what was
 * charged rather than what the price list says today: a box can be short, a box
 * can hold a substitution, and a delivery that recomputed itself from its orders
 * could never record either.
 *
 * The useful part is the subtraction. A meal company splits an order across two
 * boxes often enough that "what is still outstanding" is the question somebody
 * has in front of them when the second one turns up, and answering it by hand
 * from two notes is exactly the arithmetic a plugin should do.
 *
 * App-free.
 */
import { countsOf, outstandingOf, sumCounted, type Counted } from '../fulfilment/outstanding.js';
import type { OrderSelection } from '../order/types.js';
import type { DeliveryItem } from './types.js';

/** Enough of an order to know what it asked for and what a delivery would name it. */
export interface OrderedFrom {
  title: string;
  selections: OrderSelection[];
}

/** Enough of a delivery to know which orders it settles and what was in it. */
export interface DeliveredIn {
  orderTitles: string[];
  items: DeliveryItem[];
}

/** Titles are compared the way wikilinks are: trimmed and case-insensitively. */
function key(title: string): string {
  return title.trim().toLowerCase();
}

/**
 * A dish, in the vocabulary the arithmetic uses, and back again.
 *
 * The subtraction moved to `fulfilment/outstanding.ts` when a second feature
 * needed it -- a purchase that ships in parts asks the identical question. It
 * speaks of a `name` where this file speaks of a `mealTitle`, which is the
 * right word in a freezer and the wrong one for a bag of birdseed.
 *
 * **Nothing in the note format changed.** These two functions are the whole of
 * the difference, and the suite that covered this file before the extraction
 * covers it unchanged after, which is what makes the move safe rather than
 * merely tidy.
 */
const asCounted = (item: DeliveryItem): Counted => ({
  name: item.mealTitle,
  quantity: item.quantity,
});

/**
 * The same, for the ORDERED side, which reads a count of zero as one and trims
 * the name it keeps.
 *
 * **Only the ordered side, which is how it has always behaved here.** A missing
 * quantity means one in the note, so a hand-typed `0` on an order is somebody
 * meaning one rather than meaning none; on a delivery the same `0` is left as
 * it is. The asymmetry is inherited rather than designed, and it is written
 * down here rather than folded into the shared arithmetic, where it would
 * become a surprising rule two features had to know about. Whether the delivery
 * side should match is a real question and not one to answer by accident while
 * moving code.
 */
const asOrdered = (item: DeliveryItem): Counted => ({
  name: item.mealTitle.trim(),
  quantity: Math.max(1, item.quantity),
});

const asDelivery = (item: Counted): DeliveryItem => ({
  mealTitle: item.name,
  quantity: item.quantity,
});

/**
 * Every dish across these orders, summed, in the order the orders name them.
 *
 * Summed across people rather than kept per person, because a box is not
 * addressed to anybody: two portions of the same dish arrive as two portions,
 * whoever chose them.
 */
export function orderedItems(orders: readonly OrderedFrom[]): DeliveryItem[] {
  return sumCounted(
    orders.flatMap((order) =>
      order.selections.flatMap((selection) => selection.items.map(asOrdered))
    )
  ).map(asDelivery);
}

export function deliveredCounts(
  orderTitles: readonly string[],
  deliveries: readonly DeliveredIn[]
): Map<string, number> {
  const wanted = new Set(orderTitles.map(key));
  return countsOf(
    deliveries
      .filter((delivery) => delivery.orderTitles.some((title) => wanted.has(key(title))))
      .flatMap((delivery) => delivery.items.map(asCounted))
  );
}

/**
 * What these orders are still waiting for: ordered, minus already delivered.
 *
 * A dish that has fully arrived drops out rather than showing as zero, because
 * this fills a dialog and a row saying "none of this arrived" is a row somebody
 * has to read past. A box that over-delivered also drops out: the surplus is
 * real and recorded, and there is nothing outstanding to prefill from it.
 */
export function outstandingItems(
  orders: readonly OrderedFrom[],
  deliveries: readonly DeliveredIn[]
): DeliveryItem[] {
  const settling = deliveries.filter((delivery) =>
    delivery.orderTitles.some((title) =>
      new Set(orders.map((order) => key(order.title))).has(key(title))
    )
  );

  return outstandingOf(
    orderedItems(orders).map(asCounted),
    settling.flatMap((delivery) => delivery.items.map(asCounted))
  ).map(asDelivery);
}
