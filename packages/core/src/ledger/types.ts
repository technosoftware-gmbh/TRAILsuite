/**
 * What a household ledger is made of.
 *
 * Here rather than in NODAtrail on the note-format rule: an account and a
 * posting are records of what happened, and a vault holds them long after any
 * particular reader. A ledger whose meaning drifted between releases would be a
 * ledger whose balances drifted.
 *
 * App-free.
 */

/**
 * The four kinds an account can be.
 *
 * Fixed, because every report keys off them: the balance sheet is the assets
 * and liabilities, the income statement is the income and expenses, and there
 * is no fifth thing a household account can be. Equity is not modelled: for a
 * private household it is what is left over, and computing it is cheaper than
 * asking somebody to maintain it.
 */
export const ACCOUNT_KINDS = ['asset', 'liability', 'income', 'expense'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export function isAccountKind(value: unknown): value is AccountKind {
  return typeof value === 'string' && (ACCOUNT_KINDS as readonly string[]).includes(value);
}

/**
 * Which side of a posting increases this kind of account.
 *
 * Assets and expenses grow when debited, liabilities and income when credited.
 * This one function is the whole of double entry that the rest of the code has
 * to know about.
 */
export function increasesOnDebit(kind: AccountKind): boolean {
  return kind === 'asset' || kind === 'expense';
}

/** One account in the chart. */
export interface Account {
  /** Unique, and the sort order. */
  number: number;
  title: string;
  kind: AccountKind;
  /** `Gemeinsame Kosten/Renault Twingo`, or '' for an account that sits directly under its section. */
  group: string;
  currency: string | null;
  /** What the account held before the first posting this vault knows about. */
  opening: number;
  /** The day that opening balance is true as of. Postings before it are still counted. */
  openingDate: string | null;
  /** The day it stopped being used. Reported on, never refused. */
  closed: string | null;
  /**
   * What the bank calls this account: an IBAN, or the number a statement prints.
   *
   * The one thing that lets an imported statement line naming an account
   * resolve to an account note. A transfer between two of the household's own
   * accounts prints the other account's number, and without this it is just
   * text.
   */
  iban: string | null;
  bankAccount: string | null;
  /** The person whose account it is, as a link into the CRM. Null for a shared one. */
  personTitle: string | null;
}

/**
 * One movement of money.
 *
 * `debit` and `credit` are account numbers rather than accounts, because a
 * journal is parsed before the chart is necessarily known and a posting naming
 * an account that does not exist has to survive long enough to be reported.
 *
 * A split posting is several of these sharing a date and a description: the
 * parser expands the continuation lines rather than inventing a nested shape,
 * so everything downstream sees one flat list.
 */
export interface Posting {
  date: string;
  debit: number | null;
  credit: number | null;
  amount: number;
  currency: string | null;
  text: string;
  /** The bill or purchase note this settles, as written. */
  reference: string | null;
  /** For a foreign-currency posting: what the other side was, and in what currency. */
  counterAmount: number | null;
  counterCurrency: string | null;
  /** Which line of the journal block it came from, one based. For reporting a problem. */
  line: number;
  /**
   * The line the whole entry starts on: this posting's own line for a simple
   * one, the header's line for every leg of a split.
   *
   * **This, not `splitOf`, is what says two postings were written as one
   * entry.** `splitOf` carries the header's description, and a split is
   * perfectly allowed to have none -- three of the five in the vault this was
   * found in had none. Grouping by description silently treated each of their
   * legs as a posting of its own, and an editor acting on that would have
   * replaced a whole split with one of its legs.
   */
  entryLine: number;
  /** Set when this posting is one leg of a split, to the description of the whole. */
  splitOf: string | null;
  /**
   * The statement row this came from, when it came from an import.
   *
   * Written as a seventh field on the line and read back on the next import,
   * which is what stops the same row being posted twice. A line without one is
   * a posting somebody entered by hand, and there is nothing to compare it to.
   */
  importKey: string | null;
}

/** Something wrong with a line, reported rather than thrown. */
export interface JournalProblem {
  line: number;
  raw: string;
  reason:
    | 'unreadable'
    | 'no-date'
    | 'no-amount'
    | 'no-accounts'
    | 'split-does-not-sum'
    | 'orphan-continuation';
  /** For a split that does not sum: what it is out by. */
  difference?: number;
}

/** What a journal block holds once read. */
export interface ParsedJournal {
  postings: Posting[];
  problems: JournalProblem[];
}
