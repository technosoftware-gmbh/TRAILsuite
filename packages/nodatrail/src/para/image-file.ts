/**
 * Putting a chosen image where its note's folder wants it.
 *
 * The vault convention, which every one of the 178 images already in the one
 * this was built for follows: `<the note's own folder>/_resources/<file>`. It
 * is also what Obsidian's own `attachmentFolderPath` of `./_resources` means,
 * so an image dragged into a note by hand lands in the same place.
 *
 * **An image already in the vault is referenced, never moved.** That is the one
 * way this differs from the document filing beside it, and the reason is the
 * difference between the two things. An invoice belongs to one bill; an image
 * can be on several notes at once, and `image:` holds a plain path string
 * rather than a wikilink -- so a rename that Obsidian would follow for a link
 * may leave another note's path pointing at nothing. Referencing costs a file
 * sitting somewhere untidy; moving costs a picture disappearing from a note
 * nobody was editing.
 *
 * An image from outside the vault has no other note pointing at it, so there is
 * nothing to break and it is written in.
 *
 * **Nothing is ever overwritten.** A name already taken gets a free one.
 */
import { App, TFile, normalizePath } from 'obsidian';
import type { NODAtrailSettings } from '../settings/types';
import { fileNameOf, freeName } from '../finance/document-file';

/** The folder an image for this note belongs in. */
export function imageFolderFor(settings: NODAtrailSettings, notePath: string): string {
  // `lastIndexOf` is -1 for a note at the vault root, and `slice(0, -1)` would
  // then chop the last character off the file name rather than yield no parent.
  const cut = notePath.lastIndexOf('/');
  const parent = cut === -1 ? '' : notePath.slice(0, cut);
  const subfolder = settings.imageSubfolder.trim();
  if (!subfolder) return parent;
  return parent ? `${parent}/${subfolder}` : subfolder;
}

/** The names already used in a folder, so a new one can avoid them. */
function takenNames(app: App, folder: string): Set<string> {
  const existing = app.vault.getFolderByPath(normalizePath(folder));
  if (!existing) return new Set();
  return new Set(existing.children.map((child) => child.name));
}

/**
 * Writes an image from outside the vault beside the note that names it.
 *
 * The note has to exist first, because its folder is what decides where the
 * image goes -- which is why this runs after the note is created rather than
 * when the file was picked.
 */
export async function importOutsideImage(
  app: App,
  settings: NODAtrailSettings,
  notePath: string,
  file: File
): Promise<string> {
  const folder = imageFolderFor(settings, notePath);
  const path = normalizePath(folder);
  if (folder && !app.vault.getFolderByPath(path)) await app.vault.createFolder(path);

  const name = freeName(fileNameOf(file.name), takenNames(app, folder));
  const target = normalizePath(folder ? `${folder}/${name}` : name);

  const created = await app.vault.createBinary(target, await file.arrayBuffer());
  return created instanceof TFile ? created.path : target;
}

/** Extensions Obsidian renders as a picture. */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']);

export function isImageFile(file: TFile): boolean {
  return IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
}

/** What to show for a choice: a path, a pending filename, or nothing. */
export function imageLabel(choice: ImageChoice): string {
  return choice.outside ? choice.outside.name : choice.path;
}

/** What a form holds about an image until the note it belongs to exists. */
export interface ImageChoice {
  /** A path already in the vault, or ''. Referenced as it stands. */
  path: string;
  /** A file from outside the vault, chosen but not yet written in. */
  outside: File | null;
}

export function emptyImage(): ImageChoice {
  return { path: '', outside: null };
}

/**
 * Files whatever the form is holding, and hands back the value to record.
 *
 * The one entry point a form needs. Empty string rather than null, because
 * `image:` is written as a string and a note with no picture records nothing.
 */
export async function fileImageChoice(
  app: App,
  settings: NODAtrailSettings,
  notePath: string,
  choice: ImageChoice
): Promise<string> {
  if (choice.outside) return importOutsideImage(app, settings, notePath, choice.outside);
  return choice.path.trim();
}

/**
 * Files a pending image into a note that has just been created, and records it.
 *
 * **Two writes rather than one, and unavoidably so.** The folder an image goes
 * into is the note's own, and on the form there was no note yet -- so the note
 * is created first and its picture put beside it second. A form with no pending
 * outside file does nothing here, which is every form where the image was
 * picked from the vault or left blank.
 *
 * Returns the path recorded, or null when there was nothing to do.
 */
export async function attachPendingImage(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  choice: ImageChoice
): Promise<string | null> {
  if (!choice.outside) return null;

  const path = await importOutsideImage(app, settings, file.path, choice.outside);
  await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
    frontmatter[settings.imageProperty] = path;
  });
  return path;
}
