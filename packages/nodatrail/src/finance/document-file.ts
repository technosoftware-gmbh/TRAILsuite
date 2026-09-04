/**
 * Filing a document beside the note that is about it.
 *
 * The vault this was built for kept every invoice in one folder of a few
 * hundred PDFs, and a bill note pointed at wherever the file already was. That
 * is fine until you want to look at a month: the notes are filed by year and
 * month and the documents are not, so the two never sit together.
 *
 * So a document can now be filed into a folder beside its note, named by a
 * setting, the way Obsidian's own attachment folders work.
 *
 * **Inside the vault it moves; from outside it is copied in.** Moving avoids a
 * second copy of an invoice nobody asked for, and Obsidian rewrites the links
 * as it goes. A file the vault has never seen has nothing to move, so its bytes
 * are written to the new place and the original is left where it was, which is
 * a downloads folder somebody empties anyway.
 *
 * The path arithmetic is here and pure; the vault work is in `write-finance`.
 */
import { joinFolder } from 'trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { noteFolderFor } from './paths';
import type { NodaFolderType } from '../vault/entity-types';

/**
 * Where a document for one kind of note goes, given the date its note is filed
 * by.
 *
 * Empty when the subfolder setting is blank, which means "leave documents where
 * they are" and is what a vault that already has a filing system wants.
 */
export function documentFolderFor(
  settings: NODAtrailSettings,
  type: NodaFolderType,
  date: Date | null
): string {
  const subfolder = settings.documentSubfolder.trim();
  if (!subfolder) return '';
  return joinFolder(noteFolderFor(settings, type, date), subfolder);
}

/** The last segment of a path, extension and all. */
export function fileNameOf(path: string): string {
  const cleaned = path.replace(/\\+$/, '');
  const index = cleaned.lastIndexOf('/');
  return index === -1 ? cleaned : cleaned.slice(index + 1);
}

/** A filename split into the part before the extension and the extension itself. */
export function splitExtension(name: string): { stem: string; extension: string } {
  const index = name.lastIndexOf('.');
  // A leading dot is a hidden file rather than an extension, and a name with no
  // dot at all has no extension to preserve.
  if (index <= 0) return { stem: name, extension: '' };
  return { stem: name.slice(0, index), extension: name.slice(index) };
}

/**
 * A name that nothing in the folder already has.
 *
 * **Never overwrites.** Two invoices from one vendor in one month arrive with
 * the same name more often than not, and the second one silently replacing the
 * first would destroy a document somebody needs and say nothing.
 */
export function freeName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;

  const { stem, extension } = splitExtension(name);
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${stem} ${index}${extension}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem} ${Date.now()}${extension}`;
}

/** Where a document would land: its folder, its name, and the two joined. */
export function documentTarget(
  settings: NODAtrailSettings,
  type: NodaFolderType,
  date: Date | null,
  sourceName: string,
  taken: ReadonlySet<string>
): { folder: string; name: string; path: string } | null {
  const folder = documentFolderFor(settings, type, date);
  if (!folder) return null;

  const name = freeName(fileNameOf(sourceName), taken);
  return { folder, name, path: `${folder}/${name}` };
}
