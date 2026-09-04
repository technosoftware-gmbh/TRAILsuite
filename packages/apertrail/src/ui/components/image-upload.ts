/**
 * Putting a picture that is not in the vault yet into the vault.
 *
 * The counterpart to `image-field.ts`'s picker, and the case that one
 * deliberately does not cover. Its header says a picture already in the vault
 * is referenced and never moved, because a photo lives where its owner filed it
 * -- true, and it says nothing about a file that has never been filed anywhere.
 * Until now the answer was: put it in the vault yourself with Finder, then come
 * back and pick it.
 *
 * **Obsidian decides where it lands, not this plugin.** `attachmentFolderPath`
 * is the vault owner's already-given answer to "where do attachments go", and
 * `getAvailablePathForAttachment()` reads it, resolves it against the note the
 * picture belongs to, and returns a path nothing occupies. A vault set to
 * `./_resources` therefore files a trip's picture inside that trip's own folder
 * with no convention of ours involved, and a vault that files everything in one
 * place gets that instead. Asking twice would be the same mistake as asking for
 * the interface language twice.
 *
 * It also settles the collision, which is the part worth not writing again:
 * two cameras produce `IMG_1234.jpg` and Obsidian appends its own suffix. A
 * plugin doing that itself would eventually disagree with the one Obsidian uses
 * for every other attachment in the same vault.
 */
import { App, TFile } from 'obsidian';

/** What a file input should offer. Obsidian renders all of these. */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif';

export interface UploadedPicture {
  /** The vault path, ready to be written into frontmatter. */
  path: string;
  /** What the file was called, for a message naming the one that failed. */
  name: string;
}

export interface UploadResult {
  written: UploadedPicture[];
  /** The names that could not be written, in the order they were offered. */
  failed: string[];
}

/**
 * Writes each file into the vault beside `sourcePath`, in order.
 *
 * **One failure does not stop the rest.** Somebody selecting fourteen pictures
 * has said what they want fourteen times; losing all of it because the ninth is
 * unreadable would be the plugin discarding thirteen answers over one. The names
 * that failed come back so the caller can say which, rather than reporting a
 * count that leaves somebody comparing lists by hand.
 *
 * Sequential rather than parallel on purpose: `getAvailablePathForAttachment`
 * answers from what is in the vault at the moment it is asked, so two uploads
 * of `IMG_1234.jpg` resolved at the same time would be handed the same free
 * path and the second would overwrite the first.
 */
export async function uploadPictures(
  app: App,
  files: readonly File[],
  sourcePath: string
): Promise<UploadResult> {
  const written: UploadedPicture[] = [];
  const failed: string[] = [];

  for (const file of files) {
    try {
      const path = await app.fileManager.getAvailablePathForAttachment(file.name, sourcePath);
      const created = await app.vault.createBinary(path, await file.arrayBuffer());
      written.push({ path: created instanceof TFile ? created.path : path, name: file.name });
    } catch {
      failed.push(file.name);
    }
  }

  return { written, failed };
}

/**
 * Opens the operating system's file chooser and hands back what was picked.
 *
 * A detached `<input type="file">` rather than anything of Obsidian's, because
 * Obsidian has no API for this and the element is the only thing that can ask
 * the OS. It is never attached to the document: appending it would put a
 * control into somebody's modal that they can see and click by accident, and
 * `click()` works on a detached input in every browser this runs in.
 *
 * Resolves with an empty array when the dialog is dismissed. There is no cancel
 * event to listen for -- the reliable signal is a `change` that never comes --
 * so a caller must treat "nothing selected" as the ordinary outcome it is
 * rather than waiting for a confirmation that will not arrive.
 */
export function chooseImageFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = activeDocument.createElement('input');
    input.type = 'file';
    input.accept = IMAGE_ACCEPT;
    input.multiple = true;
    input.addEventListener('change', () => resolve(Array.from(input.files ?? [])), { once: true });
    input.click();
  });
}
