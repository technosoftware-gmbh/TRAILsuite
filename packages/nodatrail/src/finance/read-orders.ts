/**
 * The order notes a sibling plugin keeps, read for their prices.
 *
 * CULItrail records every meal order: who it was from, when, what it cost, and
 * the number the merchant issued. A card statement then bills those orders
 * weeks later, one line each, naming that same number. Entering the statement
 * by hand means reading a figure off a PDF that is already written down in the
 * vault, and typing it in again is how the two come to disagree.
 *
 * **No coupling to the plugin, only to the notes.** There is no
 * `app.plugins.getPlugin()` call and nothing imported from CULItrail, which
 * matters twice over: that package is GPL and this one is PolyForm, and the
 * notes are readable whether or not the plugin that wrote them is installed or
 * enabled. What CULItrail's settings are consulted for is where the folder is
 * and what the properties are called -- the same mechanism, and the same two
 * boundaries, as `foreign-settings-import.ts`.
 *
 * **Four facts, not the whole order.** Company, date, price and number. What
 * was actually eaten is CULItrail's business, and a ledger that read the
 * selections would be a ledger with an opinion about meals.
 */
import { App, TFile } from 'obsidian';
import {
  parseOrderFilenameStem,
  readIsoDate,
  readNumberLike,
  readString,
  linkOrText,
  normalizeCurrency,
  type OrderForMatching,
} from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import { readNotesOfType } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';

/** An order note read, with the file it came from. */
export interface OrderRecord extends OrderForMatching {
  file: TFile;
}

/**
 * Every order note in the vault, newest first.
 *
 * Empty when no orders folder exists, which is the ordinary state of a vault
 * that has NODAtrail and nothing else. Nothing about that is worth reporting.
 */
export function readOrders(app: App, settings: NODAtrailSettings): OrderRecord[] {
  const folder = settings.ordersFolder.trim();
  if (!folder) return [];

  const notes = readNotesOfType(hostFor(app), {
    folders: [folder],
    typePropertyName: settings.typePropertyName,
    typeValue: settings.orderTypeValue,
  });

  const records: OrderRecord[] = [];
  for (const note of notes) {
    // The number comes from the filename, which is where CULItrail puts it and
    // therefore the only place it cannot have drifted from.
    const stem = parseOrderFilenameStem(note.title);
    if (!stem?.orderNumber) continue;

    records.push({
      file: note.file,
      title: note.title,
      orderNumber: stem.orderNumber,
      companyTitle: linkOrText(note.frontmatter[settings.orderCompanyProperty]),
      // The property wins over the filename, since a person can correct it.
      orderDate: readIsoDate(note.frontmatter[settings.orderDateProperty]) ?? stem.orderDate,
      price: readNumberLike(note.frontmatter[settings.orderPriceProperty]),
      priceCurrency: normalizeCurrency(
        readString(note.frontmatter[settings.orderPriceCurrencyProperty])
      ),
    });
  }

  return records.sort((a, b) => (b.orderDate ?? '').localeCompare(a.orderDate ?? ''));
}
