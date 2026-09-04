/**
 * The order a list of orders is read in.
 *
 * Four fields, because an order is looked up four ways: when it was placed,
 * when it arrived, who it came from, and what it cost. Pure and App-free, like
 * the filter beside it.
 *
 * **A missing value always sorts last, in both directions.** An order with no
 * delivery date is not the earliest delivery, it is one with nothing to
 * compare, and sorting it to the top of an ascending list would say the
 * opposite.
 */
import { orderTotal } from './order-total';
import { t } from '../../lang/I18nManager';
import type { OrdersSortField, SortDirection } from '../../settings/types';
import type { OrderRecord } from '../types';

export const ORDER_SORT_FIELDS: readonly OrdersSortField[] = [
  'order-date',
  'delivery-date',
  'company',
  'total',
];

export const ORDER_SORT_ICONS: Record<OrdersSortField, string> = {
  'order-date': 'calendar',
  'delivery-date': 'truck',
  company: 'building-2',
  total: 'banknote',
};

/**
 * Written out rather than built from the field id.
 *
 * A `t(`orders.sort.${field}`)` would be shorter and would also hide these
 * four keys from `tests/translation-keys.test.ts`, which reads literal call
 * sites out of the source. A key nothing can see is a key nothing checks.
 */
export function orderSortFieldLabel(field: OrdersSortField): string {
  switch (field) {
    case 'order-date':
      return t('orders.sort.orderDate');
    case 'delivery-date':
      return t('orders.sort.deliveryDate');
    case 'company':
      return t('orders.sort.company');
    default:
      return t('orders.sort.total');
  }
}

/** What an order is worth, by the one rule every surface uses. */
function total(order: OrderRecord): number | null {
  return orderTotal(order);
}

/** Null for "this order cannot answer that question", which sorts last. */
function key(order: OrderRecord, field: OrdersSortField): string | number | null {
  switch (field) {
    case 'order-date':
      return order.orderDate;
    case 'delivery-date':
      return order.deliveryDate;
    case 'company':
      return order.companyTitle;
    default:
      return total(order);
  }
}

export function sortOrders(
  orders: readonly OrderRecord[],
  field: OrdersSortField,
  direction: SortDirection
): OrderRecord[] {
  const sign = direction === 'asc' ? 1 : -1;

  return [...orders].sort((a, b) => {
    const left = key(a, field);
    const right = key(b, field);

    if (left === null && right === null) return a.title.localeCompare(b.title);
    if (left === null) return 1;
    if (right === null) return -1;

    const compared =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));

    // A stable tie-break, so two orders from the same company on the same day
    // do not swap places between renders.
    return compared === 0 ? a.title.localeCompare(b.title) : compared * sign;
  });
}
