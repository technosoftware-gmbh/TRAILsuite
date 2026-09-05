/**
 * Reading the order notes out of the vault.
 *
 * On the same folder-and-type terms as every other kind, through the shared
 * reader, so an order is recognised the same way a meal is.
 */
import { App } from 'obsidian';
import type { CULItrailSettings } from '../settings/types';
import { readNotesOfType } from '../vault/read-notes';
import { parseOrder, type OrderProperties } from '@technosoftware/trail-core';
import type { OrderRecord } from './types';
import { selectionTitles } from '@technosoftware/trail-core';

/** The property names an order note is written and read with, gathered from settings. */
export function orderProperties(settings: CULItrailSettings): OrderProperties {
  return {
    typePropertyName: settings.typePropertyName.trim() || 'type',
    typeValue: settings.orderTypeValue,
    companyProperty: settings.orderCompanyProperty,
    orderDateProperty: settings.orderDateProperty,
    deliveryDateProperty: settings.orderDeliveryDateProperty,
    priceProperty: settings.orderPriceProperty,
    priceCurrencyProperty: settings.orderPriceCurrencyProperty,
    selectionsProperty: settings.orderSelectionsProperty,
    selectionPersonField: settings.orderSelectionPersonField,
    selectionMealsField: settings.orderSelectionMealsField,
    selectionItemsField: settings.orderSelectionItemsField,
    itemMealField: settings.orderItemMealField,
    itemPriceField: settings.orderItemPriceField,
    itemQuantityField: settings.orderItemQuantityField,
    itemDiscountField: settings.orderItemDiscountField,
    discountProperty: settings.orderDiscountProperty,
    shippingProperty: settings.orderShippingProperty,
    vatRateProperty: settings.orderVatRateProperty,
    vatAmountProperty: settings.orderVatAmountProperty,
  };
}

/**
 * Every order, newest first.
 *
 * `personTitles` is passed in rather than read here, so a caller can hand in
 * every configured person or only the eligible ones without this needing to
 * know that filter exists. It is only used to read pre-v2 notes, which name
 * nobody themselves.
 */
export function readOrders(
  app: App,
  settings: CULItrailSettings,
  personTitles: string[]
): OrderRecord[] {
  const properties = orderProperties(settings);

  return readNotesOfType(app, settings, 'order')
    .map((note) => ({
      file: note.file,
      title: note.title,
      ...parseOrder({
        stem: note.title,
        frontmatter: note.frontmatter,
        properties,
        legacyPrefix: settings.orderSelectionPropertyPrefix,
        personTitles,
      }),
    }))
    .sort((a, b) => {
      // Newest order first. An order with no readable date sorts last rather
      // than to the top, where it would look like the most recent one.
      const dates = (b.orderDate ?? '').localeCompare(a.orderDate ?? '');
      return dates !== 0 ? dates : b.orderNumber.localeCompare(a.orderNumber);
    });
}

/** Every order naming one meal, for the meal view's "ordered before" block. */
export function ordersForMeal(orders: OrderRecord[], mealTitle: string): OrderRecord[] {
  const wanted = mealTitle.trim().toLowerCase();

  return orders.filter((order) =>
    order.selections.some((selection) =>
      selectionTitles(selection).some((title) => title.trim().toLowerCase() === wanted)
    )
  );
}
