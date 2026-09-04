/**
 * Correcting a posting that is already in a journal note.
 *
 * Everything else here writes; this is the only thing that rewrites. Which
 * makes it the one place where a mistake destroys work rather than merely
 * adding to it, so it is deliberately narrow: it finds one posting by the note
 * and line it was read from, and replaces exactly those lines.
 *
 * **A posting is its header and its legs together.** Editing a leg rewrites the
 * whole split, because the header states the total the legs have to sum to and
 * changing one without the other would leave a note that will not parse.
 *
 * **A changed date can move it to another note.** Journals are one note per
 * month, so correcting January to February means taking the posting out of one
 * and putting it into the other. Removed first and inserted second: a posting
 * that exists twice is a wrong balance, and one that exists nowhere is a
 * missing line somebody can see.
 */
import { App, TFile } from 'obsidian';
import { parseDayTitle, type Posting } from 'trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { insertPostingBlock, removePostingBlock, replacePostingBlock } from './journal-text';
import { linesFor, type PendingPosting } from './import-write';
import { journalNoteFor } from './write-ledger';

/** Where a posting was read from: the note, and the line it starts or sits on. */
export interface PostingSite {
  file: TFile;
  line: number;
}

/**
 * Rewrites a posting, moving it to another month's note when its date changed.
 *
 * Returns the note it ended up in, or null when the line no longer holds a
 * posting -- which is what a stale view looks like after somebody edited the
 * note by hand, and is a reason to stop rather than to write anyway.
 */
export async function rewritePosting(
  app: App,
  settings: NODAtrailSettings,
  site: PostingSite,
  pending: PendingPosting,
  now: Date
): Promise<TFile | null> {
  const block = linesFor(pending);
  const date = parseDayTitle(pending.posting.date);
  if (!date) return null;

  const target = await journalNoteFor(app, settings, date, now);

  if (target.path === site.file.path) {
    let found = false;
    await app.vault.process(site.file, (markdown) => {
      const rewritten = replacePostingBlock(markdown, site.line, block);
      found = rewritten !== null;
      return rewritten ?? markdown;
    });
    return found ? site.file : null;
  }

  // Two notes. Out of the old one first, so a failure between the two leaves
  // the posting missing rather than duplicated.
  const removed = await removePostingAt(app, site);
  if (!removed) return null;

  await app.vault.process(target, (markdown) => insertPostingBlock(markdown, block));
  return target;
}

/**
 * Takes a posting out and puts nothing back.
 *
 * For the entry that should not exist at all: one keyed in twice, or against
 * the wrong account entirely. False when the line no longer holds a posting.
 */
export async function deletePosting(app: App, site: PostingSite): Promise<boolean> {
  return removePostingAt(app, site);
}

async function removePostingAt(app: App, site: PostingSite): Promise<boolean> {
  let found = false;
  await app.vault.process(site.file, (markdown) => {
    const without = removePostingBlock(markdown, site.line);
    found = without !== null;
    return without ?? markdown;
  });
  return found;
}

/**
 * Every posting that was written as one entry: a simple posting alone, or all
 * the legs of the split it belongs to.
 *
 * Grouped by the line the entry starts on, which every leg carries. **Not by
 * the description**: that was the first attempt and it was wrong, because a
 * split is allowed to have no description at all, and three of the five in the
 * vault this was tested against had none. Each of their legs then looked like a
 * posting of its own, and rewriting one would have replaced the whole split
 * with that single leg -- silently losing the others and the total they summed
 * to.
 */
export function entryPostings(postings: readonly Posting[], target: Posting): Posting[] {
  return postings
    .filter((posting) => posting.entryLine === target.entryLine)
    .sort((a, b) => a.line - b.line);
}
