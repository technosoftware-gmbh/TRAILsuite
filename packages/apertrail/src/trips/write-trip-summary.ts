/**
 * Reading and writing a trip's summary block.
 *
 * The one place APERtrail writes a note's **body** rather than its frontmatter.
 * `write-trip.ts` touches properties only, and this is deliberately not there:
 * the promise that file makes is that the text of a note is never rewritten by
 * a dialog, and the promise this one makes is narrower -- only the summary
 * block's own lines change, and only when they would come out different.
 *
 * **The note is re-read immediately before the write.** The form may have been
 * open for minutes while the note was edited behind it, so the splice is
 * computed against what is on disk now rather than against what was loaded when
 * the dialog opened.
 *
 * **The block's own format is `trail-core`'s.** It was written down twice, here
 * and in NODAtrail's PARA notes, and a note format belongs in the core whatever
 * the number of readers. What is left here is the half that needs an `App`.
 */
import { App, TFile } from 'obsidian';
import { readSummary, splitFrontmatterBlock, withSummary } from 'trail-core';

/** The summary on a note, or '' when it has none. */
export async function loadTripSummary(app: App, file: TFile): Promise<string> {
  const text = await app.vault.read(file);
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
 * in the vault's modification times, in what a sync reconciles, and in what a
 * backup thinks changed today.
 */
export async function writeTripSummary(app: App, file: TFile, summary: string): Promise<void> {
  const text = await app.vault.read(file);
  const { header, body } = splitFrontmatterBlock(text);

  const next = withSummary(body, summary);
  if (next === body) return;

  await app.vault.modify(file, `${header}${next}`);
}
