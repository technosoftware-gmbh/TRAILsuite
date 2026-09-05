/**
 * Reading the Deliveries folder.
 *
 * The one part of this area that needs an `App`. Everything in
 * `delivery-note.ts` is app-free and tested without a vault, which is the same
 * split the orders area uses.
 *
 * Nothing is cached: every view re-reads, so what is on screen can never drift
 * from what is on disk.
 */
import type { App } from 'obsidian';
import type { CULItrailSettings } from '../settings/types';
import { readNotesOfType } from '../vault/read-notes';
import { parseDelivery, type DeliveryProperties } from '@technosoftware/trail-core';
import type { DeliveryRecord } from './types';

export function deliveryProperties(settings: CULItrailSettings): DeliveryProperties {
  return {
    typePropertyName: settings.typePropertyName.trim() || 'type',
    typeValue: settings.deliveryTypeValue,
    deliveryDateProperty: settings.deliveryDatePropertyName,
    ordersProperty: settings.deliveryOrdersProperty,
    itemsProperty: settings.deliveryItemsProperty,
    itemMealField: settings.deliveryItemMealField,
    itemQuantityField: settings.deliveryItemQuantityField,
  };
}

/**
 * Every delivery, newest first.
 *
 * Sorted here rather than by each caller, because "newest" is the only order
 * anybody wants a delivery list in and two callers sorting it themselves is two
 * places to get the undated case wrong. A delivery with no readable date sorts
 * last: it is not newer than everything simply because it says nothing.
 */
export function readDeliveries(app: App, settings: CULItrailSettings): DeliveryRecord[] {
  const properties = deliveryProperties(settings);

  return readNotesOfType(app, settings, 'delivery')
    .map((note) => ({
      file: note.file,
      title: note.title,
      ...parseDelivery({
        stem: note.file.basename,
        frontmatter: note.frontmatter,
        properties,
      }),
    }))
    .sort((a, b) => (b.deliveryDate ?? '').localeCompare(a.deliveryDate ?? ''));
}

/**
 * The most recent delivery, or null when nothing has arrived yet.
 *
 * Undated deliveries are skipped rather than returned: "the last one" is a
 * claim about time, and a note that states no date cannot support it.
 */
export function newestDelivery(deliveries: readonly DeliveryRecord[]): DeliveryRecord | null {
  return deliveries.find((delivery) => delivery.deliveryDate !== null) ?? null;
}

/**
 * Every meal title from the most recent delivery, lower-cased for matching.
 *
 * A set rather than a list, because the only question asked of it is whether a
 * given meal was in the last box.
 */
export function lastDeliveredTitles(deliveries: readonly DeliveryRecord[]): Set<string> {
  const newest = newestDelivery(deliveries);
  if (!newest) return new Set();
  return new Set(newest.items.map((item) => item.mealTitle.trim().toLowerCase()));
}
