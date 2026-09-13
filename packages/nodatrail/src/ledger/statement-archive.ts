/**
 * Keeping the statement a set of postings came from.
 *
 * The postings say what the ledger believes; the file says what the bank said.
 * Once the two disagree there is no way back to the second unless it was kept,
 * and an export downloaded months ago is rarely still in a downloads folder.
 * So the file is copied into the vault beside the journal notes it fed, under
 * `_imports` in the year folder. **Not `_documents`**, where it used to go and
 * where an invoice for a bill still goes: an invoice is a document somebody
 * filed and looks at, a statement export is the source a run worked from and a
 * file this plugin reads back by name. One folder is browsed, the other is
 * machinery.
 *
 * **The file is the whole record.** No note is written about the import. What
 * is still unposted is worked out by replaying the archived file against the
 * ledger, every time it is asked for, so the answer is what is true now rather
 * than what was true when somebody wrote it down. That is the same rule the
 * rest of this plugin keeps about balances, and it means an import archive
 * cannot rot: correct a posting three years later and the count moves with it.
 *
 * **The day it was imported is now in the name**, which is the one thing this
 * comment used to say was missing. It was not kept because a synced vault's
 * file dates cannot be trusted, and that is still true -- which is why it is
 * written into the name at the moment of the run rather than read off `stat`
 * afterwards. A note per import is still not needed and still not here.
 *
 * Pure. The vault work is in `statement-archive-vault.ts`.
 */
import {
  CARD_ACCOUNT_PROFILE,
  SWISS_EBANKING_PROFILE,
  acceptedRows,
  parseStatement,
} from '@technosoftware/trail-core';
import type { BankStatementRow, StatementProfile } from '@technosoftware/trail-core';
import { importFileName, readImportFileName, type ImportFileName } from '../shared/import-name';

/** The formats this plugin can read, in the order a guess should try them. */
export const KNOWN_PROFILES: readonly StatementProfile[] = [
  SWISS_EBANKING_PROFILE,
  CARD_ACCOUNT_PROFILE,
];

/**
 * The name an archived statement is filed under.
 *
 * `20260913-142530_1013_20260401-20260626.csv`: when it was imported, into
 * which account, and the period the rows cover. The same three-part shape the
 * calendar archive uses, from `shared/import-name.ts`, so one folder does not
 * end up holding two conventions.
 *
 * The stamp first because the folder is a history of runs and sorting by name
 * should sort by run. The account next because one year folder holds every
 * account's statements, and a file that does not say which account it is for is
 * a file somebody has to open to find out. The period last, where a reader
 * looking for a month still finds it and where the replay still reads it.
 */
export function statementFileName(
  stamp: string,
  account: number,
  rows: readonly BankStatementRow[]
): string {
  const first = rows[0]?.date ?? '';
  const last = rows[rows.length - 1]?.date ?? first;
  return importFileName({ stamp, source: String(account), from: first, to: last }, 'csv');
}

/** What an archived statement's name says about it, or null when it says nothing. */
export interface ArchivedName extends ImportFileName {
  account: number;
}

/**
 * Reading the name back.
 *
 * Only names this plugin wrote are recognised, and only those whose source
 * segment is a number. A CSV somebody dropped into the folder themselves is
 * left alone rather than guessed at, because a wrong guess here would put a
 * statement against an account it has nothing to do with and report rows
 * unposted that were never that account's to post.
 */
export function readStatementFileName(name: string): ArchivedName | null {
  const read = readImportFileName(name, 'csv');
  if (!read || !/^\d+$/.test(read.source)) return null;
  return { ...read, account: Number(read.source) };
}

/**
 * Which format an archived file is in.
 *
 * The name does not say, and putting it there would be noise in something
 * somebody reads. Every known profile is tried and the one that accepts the
 * most rows wins, which is decisive in practice because the two differ in their
 * delimiter: a comma-separated file read as semicolon-separated yields one
 * column and no dated rows at all.
 *
 * Null when nothing accepts anything, which is what a file that is not a
 * statement looks like.
 */
export function profileFor(text: string): StatementProfile | null {
  let best: { profile: StatementProfile; rows: number } | null = null;

  for (const profile of KNOWN_PROFILES) {
    const rows = acceptedRows(parseStatement(text, profile), profile).length;
    if (rows > 0 && (!best || rows > best.rows)) best = { profile, rows };
  }

  return best?.profile ?? null;
}
