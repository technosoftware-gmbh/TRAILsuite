/**
 * Keeping the statement a set of postings came from.
 *
 * The postings say what the ledger believes; the file says what the bank said.
 * Once the two disagree there is no way back to the second unless it was kept,
 * and an export downloaded months ago is rarely still in a downloads folder.
 * So the file is copied into the vault beside the journal notes it fed, under
 * `_documents` in the year folder, exactly where an invoice for a bill goes.
 *
 * **The file is the whole record.** No note is written about the import. What
 * is still unposted is worked out by replaying the archived file against the
 * ledger, every time it is asked for, so the answer is what is true now rather
 * than what was true when somebody wrote it down. That is the same rule the
 * rest of this plugin keeps about balances, and it means an import archive
 * cannot rot: correct a posting three years later and the count moves with it.
 *
 * What it costs is history. The day a file was imported is not kept, because a
 * synced vault's file dates are not trustworthy enough to be worth a field. If
 * that turns out to matter, a note per import is the upgrade, and this comment
 * is the record of why there is not one yet.
 *
 * Pure. The vault work is in `statement-archive-vault.ts`.
 */
import {
  CARD_ACCOUNT_PROFILE,
  SWISS_EBANKING_PROFILE,
  acceptedRows,
  parseStatement,
} from 'trail-core';
import type { BankStatementRow, StatementProfile } from 'trail-core';

/** The formats this plugin can read, in the order a guess should try them. */
export const KNOWN_PROFILES: readonly StatementProfile[] = [
  SWISS_EBANKING_PROFILE,
  CARD_ACCOUNT_PROFILE,
];

/**
 * The name an archived statement is filed under.
 *
 * `20260401-20260626_1013.csv`: the period it covers, then the account it was
 * imported into. The period first because that is how the rest of this vault's
 * documents are named and how somebody looks for one -- a folder of these sorts
 * into the order the months happened.
 *
 * The account is in the name rather than only in the folder because one year
 * folder holds every account's statements, and a file that does not say which
 * account it is for is a file somebody has to open to find out.
 */
export function statementFileName(account: number, rows: readonly BankStatementRow[]): string {
  const first = rows[0]?.date ?? '';
  const last = rows[rows.length - 1]?.date ?? first;
  return `${compact(first)}-${compact(last)}_${account}.csv`;
}

/** `2026-04-01` as `20260401`, which is how this vault names a document. */
function compact(day: string): string {
  return day.replace(/-/g, '');
}

/** What an archived statement's name says about it, or null when it says nothing. */
export interface ArchivedName {
  from: string;
  to: string;
  account: number;
}

/**
 * Reading the name back.
 *
 * Only names this plugin wrote are recognised. A CSV somebody dropped into the
 * folder themselves is left alone rather than guessed at, because a wrong guess
 * here would put a statement against an account it has nothing to do with and
 * report rows unposted that were never that account's to post.
 */
export function readStatementFileName(name: string): ArchivedName | null {
  const match = /^(\d{8})-(\d{8})_(\d+)\.csv$/i.exec(name.trim());
  if (!match) return null;

  const [, from, to, account] = match;
  if (!from || !to || !account) return null;

  const day = (compacted: string) =>
    `${compacted.slice(0, 4)}-${compacted.slice(4, 6)}-${compacted.slice(6, 8)}`;
  return { from: day(from), to: day(to), account: Number(account) };
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
