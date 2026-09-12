/**
 * Reading and writing a PARA note's summary block.
 *
 * The one place in this plugin where an edit form writes a note's **body**
 * rather than its frontmatter. Everything in `edit-para.ts` touches properties
 * only, and this is deliberately not there: the promise that file makes is that
 * the text of a note is never rewritten by a dialog, and the promise this one
 * makes is narrower -- only the summary block's own lines change, and only when
 * they would come out different.
 *
 * **The note is re-read immediately before the write.** The form may have been
 * open for minutes while the note was edited in Obsidian behind it, so the
 * splice is computed against what is on disk now rather than against what was
 * loaded when the dialog opened. The same reasoning as `rewrite()` in
 * `add-to-day-modal.ts`, and for the same reason.
 *
 * **The block's own format is `trail-core`'s.** It was written down twice, here
 * and in APERtrail's trips, and a note format belongs in the core whatever the
 * number of readers. What is left here is the half that needs an `App`.
 */
import { App, TFile } from 'obsidian';
import { readSummary, splitFrontmatterBlock, withSummary } from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';

/** The summary on a note, or '' when it has none. */
export async function loadSummary(app: App, file: TFile): Promise<string> {
  const text = await hostFor(app).vault.read(file);
  return readSummary(splitFrontmatterBlock(text).body);
}

/**
 * Writes the summary, leaving every other line of the note as it was.
 *
 * The frontmatter is split off first: a property whose value began with `>`
 * would otherwise be read as the start of a callout, and the block would be
 * spliced into the middle of the note's properties.
 *
 * **A summary that has not changed is not written at all**, rather than written
 * back identical. The two look the same in the file and differ everywhere else:
 * in the vault's modification times, in a sync's conflict handling, and in what
 * a backup thinks changed today.
 */
export async function writeSummary(app: App, file: TFile, summary: string): Promise<void> {
  const host = hostFor(app);
  const text = await host.vault.read(file);
  const { header, body } = splitFrontmatterBlock(text);

  const next = withSummary(body, summary);
  if (next === body) return;

  await host.vault.modify(file, `${header}${next}`);
}
