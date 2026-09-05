/**
 * What the orders toolbar leaves on screen.
 *
 * Pure, and App-free: it is handed the orders and the delivery titles, and
 * answers with the subset. That is what makes the rules testable without a
 * vault, and it is the same arrangement the gallery's filter has.
 *
 * A word about the delivery filter. An order and the box it arrives in are two
 * notes, joined by the delivery naming the order's title, so "nothing has
 * arrived against this" is a question about the *other* note. It is asked here
 * rather than in the view because it is a rule about what an order means, not
 * about how one is drawn.
 */
import { selectionTitles } from '@technosoftware/trail-core';
import type { OrdersSavedState } from '../../settings/types';
import type { OrderRecord } from '../types';

/** The filters, cleared. Search is deliberately not among them: see the gallery's. */
export const CLEARED_ORDER_FILTERS = {
  company: null,
  year: null,
  withoutDelivery: false,
} satisfies Partial<OrdersSavedState>;

export function hasActiveOrderFilters(state: OrdersSavedState): boolean {
  return state.company !== null || state.year !== null || state.withoutDelivery;
}

/** Every company that ordered something, in alphabetical order, without repeats. */
export function distinctCompanies(orders: readonly OrderRecord[]): string[] {
  const titles = new Set<string>();
  for (const order of orders) {
    if (order.companyTitle) titles.add(order.companyTitle);
  }
  return [...titles].sort((a, b) => a.localeCompare(b));
}

/**
 * The years orders were placed in, newest first.
 *
 * From the order date rather than from the file, because a note written in
 * January about a December order belongs to December.
 */
export function distinctYears(orders: readonly OrderRecord[]): string[] {
  const years = new Set<string>();
  for (const order of orders) {
    if (order.orderDate) years.add(order.orderDate.slice(0, 4));
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}

/** Every order title some delivery names, which is what "delivered" means here. */
export function deliveredOrderTitles(
  deliveries: readonly { orderTitles: string[] }[]
): Set<string> {
  const titles = new Set<string>();
  for (const delivery of deliveries) {
    for (const title of delivery.orderTitles) titles.add(title);
  }
  return titles;
}

/**
 * What one order can be searched by: who it was from, what it was called, and
 * what was in it.
 *
 * The dishes are included because "when did we last order the ramen" is the
 * question this list is opened with, and the company alone cannot answer it.
 */
function haystack(order: OrderRecord): string {
  return [
    order.companyTitle ?? '',
    order.orderNumber,
    order.title,
    ...order.selections.flatMap((selection) => [
      selection.personTitle,
      ...selectionTitles(selection),
    ]),
  ]
    .join(' ')
    .toLowerCase();
}

export function filterOrders(
  orders: readonly OrderRecord[],
  state: OrdersSavedState,
  delivered: Set<string>
): OrderRecord[] {
  const query = state.search.trim().toLowerCase();

  return orders.filter((order) => {
    if (state.company !== null && order.companyTitle !== state.company) return false;
    if (state.year !== null && (order.orderDate ?? '').slice(0, 4) !== state.year) return false;
    if (state.withoutDelivery && delivered.has(order.title)) return false;
    if (query && !haystack(order).includes(query)) return false;
    return true;
  });
}
