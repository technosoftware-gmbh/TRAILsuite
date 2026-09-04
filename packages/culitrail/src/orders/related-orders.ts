/**
 * Which orders a Person or a Company note is the subject of.
 *
 * Two questions, not one, and they are answered from opposite ends of the same
 * record: a Person note asks "what did I choose, and when", a Company note asks
 * "what did we order from them". Keeping them as two functions rather than one
 * polymorphic lookup is what lets each return only the part of an order that
 * answers its own question.
 *
 * App-free, so the matching is testable without a vault.
 */
import type { OrderRecord, OrderSelection } from './types';
import { selectionTitles } from 'trail-core';

/** Titles compare case-insensitively and trimmed, the way every other title match here does. */
function sameTitle(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export interface PersonOrder {
  order: OrderRecord;
  /** Only this person's selection. The rest of the order is somebody else's business. */
  selection: OrderSelection;
}

/**
 * Every order this person chose something in, newest first.
 *
 * `readOrders()` already sorts newest first, so the filter preserves that rather
 * than sorting again: two sorts that could disagree is one too many.
 *
 * A person named in an order with an empty meal list still counts. That is a
 * real state, written by somebody who recorded who was in on an order before
 * deciding what they wanted, and dropping it would make the order look like it
 * never involved them.
 */
export function ordersForPerson(orders: OrderRecord[], personTitle: string): PersonOrder[] {
  const out: PersonOrder[] = [];

  for (const order of orders) {
    const selection = order.selections.find((entry) => sameTitle(entry.personTitle, personTitle));
    if (selection) out.push({ order, selection });
  }

  return out;
}

/** Every order placed with this company, newest first. */
export function ordersForCompany(orders: OrderRecord[], companyTitle: string): OrderRecord[] {
  return orders.filter(
    (order) => order.companyTitle !== null && sameTitle(order.companyTitle, companyTitle)
  );
}

/**
 * The orders that name a dish, newest first.
 *
 * Newest first because the only caller so far asks "who sold us this most
 * recently", and sorting here rather than at that call site keeps the ordering
 * one decision instead of two. An order with no date sorts last: it cannot be
 * the most recent thing that happened without saying when it happened.
 */
export function ordersForMeal(orders: OrderRecord[], mealTitle: string): OrderRecord[] {
  return orders
    .filter((order) =>
      order.selections.some((selection) =>
        selectionTitles(selection).some((title) => sameTitle(title, mealTitle))
      )
    )
    .sort((a, b) => (b.orderDate ?? '').localeCompare(a.orderDate ?? ''));
}

/**
 * What a run of orders came to, and in which currency.
 *
 * Null when nothing in the run carries a price, so a block can leave the total
 * out rather than print a confident zero for a company whose orders nobody
 * priced.
 *
 * A mixed-currency run returns no total either. Adding CHF to EUR would produce
 * a number that is wrong in both, and a household that orders in two currencies
 * is better served by no total than by a plausible one.
 */
export function orderTotal(orders: OrderRecord[]): { amount: number; currency: string } | null {
  const priced = orders.filter((order) => order.price !== null);
  if (priced.length === 0) return null;

  const currencies = new Set(
    priced.map((order) => (order.priceCurrency ?? '').trim().toLowerCase()).filter((c) => c !== '')
  );
  if (currencies.size > 1) return null;

  return {
    amount: priced.reduce((sum, order) => sum + (order.price ?? 0), 0),
    currency: priced.find((order) => order.priceCurrency)?.priceCurrency ?? '',
  };
}
