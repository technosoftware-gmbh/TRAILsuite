/**
 * Creating and editing an order note.
 *
 * A new order is written whole; an edit goes through `processFrontMatter` so
 * anything somebody added below the frontmatter survives. That asymmetry is
 * the point: an order note is a record, and a record people annotate.
 */
import { App, normalizePath, stringifyYaml, TFile } from 'obsidian';
import { createdEntry, localDateISO, stampModified } from 'trail-core';
import { ensureParentFolders } from '../shared/vault-io';
import type { CULItrailSettings } from '../settings/types';
import {
  buildOrderFrontmatter,
  legacySelectionProperty,
  orderFilenameStem,
  type OrderContent,
} from 'trail-core';
import { orderProperties } from './read-orders';

export interface NewOrder extends Omit<OrderContent, 'orderDate'> {
  orderNumber: string;
  orderDate: Date;
}

/** The folder orders are written to, or null when the setting is blank. */
function ordersFolder(settings: CULItrailSettings): string | null {
  const folder = settings.ordersFolder.trim();
  // Blank means the folder is not configured, not the vault root. Same rule
  // the readers follow, and the safer of the two by a wide margin.
  return folder || null;
}

export async function createOrderNote(
  app: App,
  settings: CULItrailSettings,
  order: NewOrder
): Promise<TFile | null> {
  const folder = ordersFolder(settings);
  if (!folder) return null;

  const properties = orderProperties(settings);
  // The type key is written before the spread purely to fix the key order:
  // re-assigning a key that is already present leaves it where it was, so the
  // builder's own type value wins and `created` still sits second.
  const frontmatter = {
    [properties.typePropertyName]: properties.typeValue,
    ...createdEntry(settings),
    ...buildOrderFrontmatter(properties, {
      ...order,
      orderDate: localDateISO(order.orderDate),
    }),
  };

  const path = normalizePath(
    `${folder}/${orderFilenameStem(order.orderDate, order.orderNumber)}.md`
  );
  if (app.vault.getFileByPath(path)) return null;

  await ensureParentFolders(app, path);
  return app.vault.create(path, `---\n${stringifyYaml(frontmatter).trimEnd()}\n---\n`);
}

/**
 * Rewrites an existing order's frontmatter.
 *
 * The order date is not part of the edit surface: an order happened when it
 * happened, and restamping it on every edit would quietly rewrite history.
 * The number is, and because the filename encodes it, changing it renames
 * the file.
 *
 * `knownPersons` is every person the editor offered, not just those with a
 * pick. A person unchecked during this edit needs their now-stale v1 or v2
 * entry actually removed, and the builder only ever emits what should be
 * present, never a list of what to delete.
 */
export async function updateOrderNote(
  app: App,
  settings: CULItrailSettings,
  file: TFile,
  orderDate: Date,
  order: Omit<NewOrder, 'orderDate'>,
  knownPersons: string[]
): Promise<TFile> {
  const properties = orderProperties(settings);
  const next = buildOrderFrontmatter(properties, { ...order, orderDate: localDateISO(orderDate) });

  await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
    // Every property this note could be carrying from a previous save is
    // cleared first, so unsetting a price or a delivery date actually removes
    // it rather than leaving the old value behind. Names only: `typeValue` is
    // in the same object and is a value, not a key.
    const written = [
      properties.companyProperty,
      properties.orderDateProperty,
      properties.deliveryDateProperty,
      properties.priceProperty,
      properties.priceCurrencyProperty,
      properties.selectionsProperty,
    ];
    for (const key of written) delete frontmatter[key];
    for (const person of knownPersons) {
      delete frontmatter[legacySelectionProperty(settings.orderSelectionPropertyPrefix, person)];
    }

    Object.assign(frontmatter, next);
    // In this pass rather than one of its own: an edit is one write, so it
    // gets one stamp. `created` is deliberately not touched, here or anywhere
    // else that edits a note that already existed.
    stampModified(frontmatter, settings);
  });

  const folder = ordersFolder(settings);
  if (!folder) return file;

  const wanted = normalizePath(`${folder}/${orderFilenameStem(orderDate, order.orderNumber)}.md`);
  if (wanted !== file.path && !app.vault.getFileByPath(wanted)) {
    await app.fileManager.renameFile(file, wanted);
  }

  return file;
}
