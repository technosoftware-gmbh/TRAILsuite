/**
 * Reading and writing a note's summary block.
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
 *
 * It was `trips/write-trip-summary.ts` until a ship's brochure wanted the same
 * block off a vehicle note. Nothing about it was ever a trip's: the callout is
 * a note format, and every note in this vault may carry one.
 */
import { App, TFile } from 'obsidian';
import {
  countSummaries,
  readSummary,
  splitFrontmatterBlock,
  withSummary,
} from '@technosoftware/trail-core';

/** The summary on a note, or '' when it has none. */
export async function loadNoteSummary(app: App, file: TFile): Promise<string> {
  const text = await app.vault.read(file);
  return readSummary(splitFrontmatterBlock(text).body);
}

/** What a save did, for a caller that has something to say about it. */
export interface SummaryWrite {
  /** False when the text had not changed and nothing was written. */
  written: boolean;
  /**
   * Summary callouts in the note beyond the one that was edited.
   *
   * Zero for every note anybody has written by hand or through a form. A note
   * with two is a note where the second is invisible to everything -- the
   * form, the prospect, the trip document all take the first -- so the count
   * comes back rather than being swallowed, and the dialog says so.
   */
  ignored: number;
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
 *
 * What the callout's opening line says is the note's, not this plugin's --
 * `withSummary` rewrites the quoted lines and nothing else. See its own
 * docstring for why.
 */
export async function writeNoteSummary(
  app: App,
  file: TFile,
  summary: string
): Promise<SummaryWrite> {
  const text = await app.vault.read(file);
  const { header, body } = splitFrontmatterBlock(text);

  const next = withSummary(body, summary);
  const ignored = Math.max(0, countSummaries(body) - 1);

  if (next === body) return { written: false, ignored };

  await app.vault.modify(file, `${header}${next}`);
  return { written: true, ignored };
}
