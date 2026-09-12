/**
 * Turning an approved import plan into lines in the journal notes.
 *
 * Split out of the modal so the shape of what gets written can be tested
 * without a vault. The modal decides; this writes.
 */
import { App, TFile } from 'obsidian';
import { formatPosting, parseDayTitle, type Posting } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { insertPostingBlock } from './journal-text';
import { journalNoteFor } from './write-ledger';

/** One leg of a split somebody filled in. */
export interface SplitLeg {
  account: number;
  amount: number;
  text: string;
  /**
   * The invoice this leg pays, by title, when it pays one.
   *
   * A bank batches several payments into one row, and one of them is often an
   * invoice the vault already holds. Without this the leg could be booked to
   * the right account and the invoice would still be sitting open -- and
   * marking it paid afterwards would post the same money twice.
   *
   * Never written to the journal line: it says which note to stamp, not what
   * the posting is.
   */
  settles?: string | null;
}

/** A posting to write, either simple or split. */
export interface PendingPosting {
  posting: Posting;
  /** Empty for a simple posting. When set, the posting's own account is replaced by these. */
  legs: readonly SplitLeg[];
}

/**
 * The lines a pending posting becomes.
 *
 * A simple posting is one line. A split is a header naming only the account
 * that paid, and one indented leg per account it was split across, which is the
 * form the parser reads back.
 *
 * **The caller decides which side the legs replace**, by leaving that side null
 * on the posting. It is the only party that knows: for money leaving an
 * account the legs are the expenses, and for money arriving they are the
 * sources. Guessing here would put the legs on the wrong side of half of them.
 */
export function linesFor(pending: PendingPosting): string[] {
  const { posting, legs } = pending;
  if (legs.length === 0) return [formatPosting(posting)];

  const indented = legs.map(
    (leg) => `    ${leg.account} | ${leg.amount.toFixed(2)}${leg.text ? ` | ${leg.text}` : ''}`
  );
  return [formatPosting(posting), ...indented];
}

export interface WriteResult {
  written: number;
  files: TFile[];
}

/**
 * Writes every pending posting into the journal for its own month.
 *
 * Grouped by month first, so a year of postings touches twelve notes rather
 * than opening one per posting. Within a month the lines go in date order,
 * which `insertPostingBlock` decides.
 */
export async function writePostings(
  app: App,
  settings: NODAtrailSettings,
  pending: readonly PendingPosting[],
  now: Date
): Promise<WriteResult> {
  const byMonth = new Map<string, PendingPosting[]>();
  for (const item of pending) {
    const month = item.posting.date.slice(0, 7);
    const list = byMonth.get(month);
    if (list) list.push(item);
    else byMonth.set(month, [item]);
  }

  const files: TFile[] = [];
  let written = 0;

  for (const [month, items] of [...byMonth.entries()].sort()) {
    const date = parseDayTitle(`${month}-01`);
    if (!date) continue;

    const file = await journalNoteFor(app, settings, date, now);
    files.push(file);

    // One pass over the note per month rather than one per posting: a hundred
    // separate rewrites of the same file would be a hundred chances for a
    // concurrent edit to be lost.
    await app.vault.process(file, (markdown) => {
      let text = markdown;
      for (const item of items) {
        text = insertPostingBlock(text, linesFor(item));
        written += 1;
      }
      return text;
    });
  }

  return { written, files };
}
