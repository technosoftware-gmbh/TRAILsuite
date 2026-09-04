/**
 * Creating and editing a delivery note.
 *
 * The same shape as `orders/write-order.ts`, down to the create-whole,
 * edit-through-`processFrontMatter` asymmetry: a new note is written in one
 * piece, and an edit leaves anything somebody typed below the frontmatter
 * alone.
 */
import { App, normalizePath, stringifyYaml, TFile } from 'obsidian';
import { createdEntry, stampModified } from 'trail-core';
import type { CULItrailSettings } from '../settings/types';
import { ensureParentFolders } from '../shared/vault-io';
import { buildDeliveryFrontmatter, deliveryFilenameStem, type DeliveryContent } from 'trail-core';
import { deliveryProperties } from './read-deliveries';

/** The folder deliveries are written to, or null when the setting is blank. */
function deliveriesFolder(settings: CULItrailSettings): string | null {
  // Blank means unconfigured rather than the vault root, which is the rule
  // every writer in this plugin follows.
  return settings.deliveriesFolder.trim() || null;
}

/**
 * The path for a delivery on this date, with a suffix when the day is taken.
 *
 * Two boxes on one day is the case this exists for. Counting up rather than
 * refusing, because the second box is as real as the first and the person
 * recording it should not have to invent a name for it.
 */
function freePath(app: App, folder: string, deliveryDate: string): string {
  const path = (suffix: string): string =>
    normalizePath(`${folder}/${deliveryFilenameStem(deliveryDate, suffix)}.md`);

  if (!app.vault.getFileByPath(path(''))) return path('');
  for (let n = 2; n < 100; n += 1) {
    if (!app.vault.getFileByPath(path(String(n)))) return path(String(n));
  }
  return path(String(Date.now()));
}

export async function createDeliveryNote(
  app: App,
  settings: CULItrailSettings,
  content: DeliveryContent
): Promise<TFile | null> {
  const folder = deliveriesFolder(settings);
  if (!folder || !content.deliveryDate) return null;

  const properties = deliveryProperties(settings);
  // The type key is written before the spread purely to fix the key order:
  // re-assigning a key that is already there leaves it where it was, so the
  // builder's own value wins and `created` still sits second.
  const frontmatter = {
    [properties.typePropertyName]: properties.typeValue,
    ...createdEntry(settings),
    ...buildDeliveryFrontmatter(properties, content),
  };

  const path = freePath(app, folder, content.deliveryDate);
  await ensureParentFolders(app, path);
  return app.vault.create(path, `---\n${stringifyYaml(frontmatter).trimEnd()}\n---\n`);
}

/**
 * Rewrites an existing delivery's frontmatter.
 *
 * The file is not renamed when the date changes. A delivery filename is a
 * convenience rather than a contract the way an order's is: the date property
 * wins on read, so a corrected date is already the one that counts, and
 * renaming would break every link somebody has made to the note.
 */
export async function updateDeliveryNote(
  app: App,
  settings: CULItrailSettings,
  file: TFile,
  content: DeliveryContent
): Promise<TFile> {
  const properties = deliveryProperties(settings);
  const next = buildDeliveryFrontmatter(properties, content);

  await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
    // Cleared first, so removing the last item or unlinking the last order
    // actually empties the property rather than leaving the old list behind.
    for (const key of [
      properties.deliveryDateProperty,
      properties.ordersProperty,
      properties.itemsProperty,
    ]) {
      delete frontmatter[key];
    }

    Object.assign(frontmatter, next);
    stampModified(frontmatter, settings);
  });

  return file;
}
