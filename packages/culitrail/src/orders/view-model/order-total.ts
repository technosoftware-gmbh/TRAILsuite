/**
 * What an order is worth, in the one place that decides it.
 *
 * **An order that has line prices is totalled from them**, because the editor is
 * what wrote both and it computes the total rather than asking for it. **An
 * order that has none uses the total somebody typed**, which is every order
 * written before line prices existed and the only thing such a note knows about
 * money. There is never a third case.
 *
 * It lives here rather than inside the document adapter because three surfaces
 * ask the question -- the invoice document, the card in the orders list, and the
 * sort behind that list -- and for a while they did not all answer it the same
 * way. The document was computed-first and the other two were stated-first. No
 * order in the vault could tell them apart, since the four that carry line
 * prices all agree with their stated total, so the disagreement was invisible
 * and would have stayed invisible until somebody edited a note by hand.
 *
 * Two numbers for one order, on two screens, is the failure this exists to make
 * impossible.
 *
 * App-free.
 */
import { computedOrderTotal, type ParsedOrder } from 'trail-core';

export function orderTotal(order: ParsedOrder): number | null {
  return computedOrderTotal(order) ?? order.price;
}
