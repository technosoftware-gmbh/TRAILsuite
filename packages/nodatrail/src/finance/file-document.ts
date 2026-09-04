/**
 * Putting a chosen document where its note's folder wants it.
 *
 * Two ways in, and they deserve different treatment. A file already in the
 * vault is **moved**, through Obsidian's own rename so every link to it follows;
 * a second copy of an invoice is a second thing to keep in step. A file from
 * outside has nothing to move, so its bytes are written into the vault and the
 * original is left alone in whatever downloads folder it came from.
 *
 * **Nothing is ever overwritten**, and a document that cannot be filed is
 * reported rather than dropped: a bill whose invoice went missing between the
 * form and the note is worse than one that never had a document at all.
 */
import { App, TFile, normalizePath } from 'obsidian';
import type { NODAtrailSettings } from '../settings/types';
import type { NodaFolderType } from '../vault/entity-types';
import { documentFolderFor, fileNameOf, freeName } from './document-file';
import { noteFolderFor } from './paths';

/** The names already used in a folder, so a new one can avoid them. */
function takenNames(app: App, folder: string): Set<string> {
  const existing = app.vault.getFolderByPath(normalizePath(folder));
  if (!existing) return new Set();
  return new Set(existing.children.map((child) => child.name));
}

async function ensureFolder(app: App, folder: string): Promise<void> {
  const path = normalizePath(folder);
  if (!app.vault.getFolderByPath(path)) await app.vault.createFolder(path);
}

/**
 * Moves a document already in the vault into its note's document folder.
 *
 * Returns the path it ended up at, which is the path it started at when no
 * subfolder is configured or when it is already in the right place.
 */
export async function fileVaultDocument(
  app: App,
  settings: NODAtrailSettings,
  type: NodaFolderType,
  date: Date | null,
  sourcePath: string
): Promise<string> {
  const file = app.vault.getFileByPath(normalizePath(sourcePath));
  const folder = documentFolderFor(settings, type, date);
  if (!file || !folder) return sourcePath;
  if (file.parent?.path === normalizePath(folder)) return file.path;

  await ensureFolder(app, folder);
  const name = freeName(fileNameOf(file.name), takenNames(app, folder));

  // Obsidian's own rename rather than a vault move, so every note already
  // linking this file follows it.
  await app.fileManager.renameFile(file, normalizePath(`${folder}/${name}`));
  return `${folder}/${name}`;
}

/**
 * Writes a document from outside the vault into its note's document folder.
 *
 * Falls back to the note's own folder when no document subfolder is
 * configured: a file picked from a downloads folder has to land somewhere
 * inside the vault before anything can link to it.
 */
export async function importOutsideDocument(
  app: App,
  settings: NODAtrailSettings,
  type: NodaFolderType,
  date: Date | null,
  file: File
): Promise<string> {
  const folder = documentFolderFor(settings, type, date) || noteFolderFor(settings, type, date);
  await ensureFolder(app, folder);

  const name = freeName(fileNameOf(file.name), takenNames(app, folder));
  const path = normalizePath(`${folder}/${name}`);

  const created = await app.vault.createBinary(path, await file.arrayBuffer());
  return created instanceof TFile ? created.path : path;
}

/** What a form holds about a document before it is filed. */
export interface DocumentChoice {
  path: string;
  outside: File | null;
}

/**
 * Files whatever the form is holding, and hands back the path to record.
 *
 * The one entry point a form needs, so no caller has to know which of the two
 * cases it is in. Null when there is no document, which is what a note with no
 * invoice behind it should record.
 */
export async function fileDocumentChoice(
  app: App,
  settings: NODAtrailSettings,
  type: NodaFolderType,
  date: Date | null,
  choice: DocumentChoice
): Promise<string | null> {
  if (choice.outside) return importOutsideDocument(app, settings, type, date, choice.outside);
  const path = choice.path.trim();
  if (!path) return null;
  return fileVaultDocument(app, settings, type, date, path);
}

/**
 * Every choice on a form, filed, in the order the form showed them.
 *
 * Sequential rather than concurrent. Each call may create the folder and may
 * rename around a name already taken, and two of those racing would be two
 * files deciding they can both have the same name.
 */
export async function fileDocumentChoices(
  app: App,
  settings: NODAtrailSettings,
  type: NodaFolderType,
  date: Date | null,
  choices: readonly DocumentChoice[]
): Promise<string[]> {
  const filed: string[] = [];
  for (const choice of choices) {
    const path = await fileDocumentChoice(app, settings, type, date, choice);
    if (path) filed.push(path);
  }
  return filed;
}
