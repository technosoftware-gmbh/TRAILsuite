/**
 * Waiting for Obsidian to finish reading a note it was just told to write.
 *
 * **The window this closes.** A write resolves when the file is on disk. The
 * metadata cache is re-parsed afterwards, and until it has been,
 * `getFileCache(file)?.frontmatter` does not describe the note that is there.
 * A view redrawn inside that window reads a note with no `type`, and since a
 * note is identified by folder **and** type together, it fails the test and
 * disappears from a gallery it belongs in. The next manual refresh brings it
 * back, which is what makes the bug look like a rendering fault rather than a
 * timing one.
 *
 * A save is two vault writes -- the frontmatter pass and the body -- so the
 * window is real rather than theoretical. `write-excursion.ts` in APERtrail
 * already names it, in a comment about merging the modified stamp into the
 * frontmatter pass: two passes are two writes and two cache invalidations for
 * one logical edit.
 *
 * **This is not a subscription.** It resolves once and unsubscribes, so a view
 * that has decided to refresh only when asked keeps that decision; all it
 * changes is when "now" is.
 *
 * **It always resolves, and never rejects.** The timeout is a backstop, not a
 * guess at how long a parse takes: if the event has already fired, or is never
 * going to, a view that redraws slightly late is a great deal better than one
 * that never redraws at all.
 */
import type { App, EventRef, TAbstractFile } from 'obsidian';

/** Long enough to cover a re-parse, short enough that nobody waits on a backstop. */
const SETTLE_MS = 600;

export interface IndexedOptions {
  /**
   * The note to wait for, by path.
   *
   * Null waits for the next note the cache re-reads, whichever it is, which is
   * what a caller that was not told which file was written has to settle for.
   * In the moment after a save that is overwhelmingly the note that was saved,
   * and the backstop covers it either way.
   */
  path?: string | null;
  timeoutMs?: number;
}

export function whenIndexed(app: App, options: IndexedOptions = {}): Promise<void> {
  const { path = null, timeoutMs = SETTLE_MS } = options;

  return new Promise<void>((resolve) => {
    let done = false;
    let ref: EventRef | null = null;

    const finish = (): void => {
      if (done) return;
      done = true;
      if (ref) app.metadataCache.offref(ref);
      clearTimeout(timer);
      resolve();
    };

    const timer = setTimeout(finish, timeoutMs);

    ref = app.metadataCache.on('changed', (file: TAbstractFile) => {
      if (path !== null && file.path !== path) return;
      finish();
    });
  });
}
