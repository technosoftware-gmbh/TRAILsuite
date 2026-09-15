/**
 * Writing an exported sheet into the vault, and saying where it went.
 *
 * APERtrail's four exporters had a copy of this each until one of them lost a
 * step (the photo spot field sheet never made its parent folders), and then
 * one copy in APERtrail. It moved here with the print stylesheet, when
 * NODAtrail's ledger sheets became the second plugin to write sheets: the tail
 * of an export is the part nobody looks at, which is exactly the part that
 * drifts when there are two.
 *
 * **Replacing rather than versioning.** A sheet is a rendering of notes and
 * can be made again from them, so a folder of "Bilanz 2.html" would be worse
 * than a stale copy overwritten.
 *
 * The host says things and opens things; this decides the order and what a
 * failure of each means. That split keeps `Notice` and the workspace in the
 * plugins, where the adapter is two lines, and the decisions here under test.
 *
 * App-free.
 */
import { normalizePath } from '../paths/folders.js';
import { ensureParentFolders } from './notes.js';
import type { VaultFile, VaultHost } from './ports.js';

export interface SheetWriteHooks<F extends VaultFile> {
  /** Shows one message. */
  notify(message: string): void;
  /** Shows the written file. May throw; see `writeSheet`. */
  open(file: F): Promise<void>;
  /** The message after a write, naming the path: which is also what says the folder changed. */
  written(path: string): string;
  /** The message when the vault refused and gave no reason of its own. */
  failed: string;
}

/**
 * Writes the sheet, says where, and opens it.
 *
 * **Opened on a replacement as much as on a first write.** Re-exporting to
 * check a change is exactly when the result should be in front of you.
 *
 * **The open has its own try, and a failure in it is swallowed.** A sheet that
 * was written and could not be shown has still been written, so reporting a
 * failure would be a lie about the vault, and every caller fires an export
 * with `void`, which would turn a cosmetic problem into an unhandled
 * rejection.
 *
 * Null when the write itself failed, after saying so.
 */
export async function writeSheet<F extends VaultFile>(
  host: VaultHost<F>,
  path: string,
  html: string,
  hooks: SheetWriteHooks<F>
): Promise<F | null> {
  const target = normalizePath(path);
  let file: F;

  try {
    await ensureParentFolders(host, target);
    const existing = host.vault.getFile(target);
    if (existing) {
      await host.vault.modify(existing, html);
      file = existing;
    } else {
      file = await host.vault.create(target, html);
    }
    hooks.notify(hooks.written(target));
  } catch (err) {
    hooks.notify(err instanceof Error ? err.message : hooks.failed);
    return null;
  }

  try {
    await hooks.open(file);
  } catch {
    // See above: the message naming the path has already been shown, which is
    // what somebody needs to find the file by hand.
  }
  return file;
}
