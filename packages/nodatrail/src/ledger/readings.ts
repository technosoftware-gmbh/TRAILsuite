/**
 * What each ledger tab reads out of the ledger: one function per tab, used by
 * the view that draws it and by the sheet that prints it.
 *
 * **One computation, two renderings.** Every tab used to compute its figures
 * inline, with options that change the answer: whether empty accounts count,
 * how a foreign currency converts, which day a balance sheet is about. A sheet
 * calling `balanceSheet` itself would one day pass a different option and
 * print a net worth the screen does not show. So the options are decided here
 * and nowhere else, and the view and the sheet both ask.
 *
 * App-free: a reading takes the ledger as read and a period as two days.
 */
import {
  addDays,
  balanceAt,
  formatDayTitle,
  parseDayTitle,
  balanceSheet,
  cashOut,
  incomeStatement,
  statement,
  type Account,
  type BalanceSheet,
  type CashOut,
  type Converter,
  type IncomeStatement,
  type StatementRow,
} from '@technosoftware/trail-core';
import type { Ledger } from './read-ledger';

export interface Period {
  from: string;
  to: string;
}

type LedgerFigures = Pick<Ledger, 'accounts' | 'postings'>;

/**
 * Empty accounts are left out of every report reading. A chart of eighty
 * accounts of which thirty never moved is a page somebody scrolls past, and
 * the account exists whether or not a report about a period mentions it.
 */
const HIDE_EMPTY = true;

/** The chart: what is held and owed at the end of the period, and what came and went during it. */
export interface ChartReading {
  held: BalanceSheet;
  flows: IncomeStatement;
}

export function chartReading(
  ledger: LedgerFigures,
  period: Period,
  convert: Converter
): ChartReading {
  const options = { convert, hideEmpty: HIDE_EMPTY };
  return {
    held: balanceSheet(ledger.accounts, ledger.postings, period.to, options),
    flows: incomeStatement(ledger.accounts, ledger.postings, period.from, period.to, options),
  };
}

/**
 * The balance sheet on the last day of the period, not on today. A balance
 * sheet is a statement about a day, and the day worth asking about is the one
 * the rest of the view is showing.
 */
export function balanceReading(
  ledger: LedgerFigures,
  period: Period,
  convert: Converter
): BalanceSheet {
  return balanceSheet(ledger.accounts, ledger.postings, period.to, {
    convert,
    hideEmpty: HIDE_EMPTY,
  });
}

export type IncomeReading =
  { basis: 'accrual'; report: IncomeStatement } | { basis: 'cash'; report: CashOut };

/** The period on the basis asked for: what it cost, or what left the accounts. */
export function incomeReading(
  ledger: LedgerFigures,
  period: Period,
  basis: 'accrual' | 'cash',
  convert: Converter
): IncomeReading {
  const options = { convert, hideEmpty: HIDE_EMPTY };
  return basis === 'cash'
    ? { basis, report: cashOut(ledger.accounts, ledger.postings, period.from, period.to, options) }
    : {
        basis,
        report: incomeStatement(ledger.accounts, ledger.postings, period.from, period.to, options),
      };
}

/** One account over the period, in its own currency. */
export interface StatementReading {
  account: Account;
  /** The balance at the end of the day before the period starts. */
  opening: number;
  /** The balance at the end of the period's last day. */
  closing: number;
  /** Oldest first, each with its running balance. */
  rows: StatementRow[];
}

/**
 * The account a statement is about: the one asked for, or the first asset,
 * or the first account there is. Null for a ledger with no accounts.
 */
export function statementAccount(
  accounts: readonly Account[],
  wanted: number | null
): Account | null {
  return (
    accounts.find((account) => account.number === wanted) ??
    accounts.find((account) => account.kind === 'asset') ??
    accounts[0] ??
    null
  );
}

/**
 * One account's movements in the period, opening and closing where a bank
 * statement has them.
 *
 * **Bounded by the period**, as a bank's statement is. It used to be every
 * posting the account had ever seen, which is a list that only grows and
 * cannot be held up against the paper the bank sends for one month.
 */
export function statementReading(
  ledger: LedgerFigures,
  account: Account,
  period: Period
): StatementReading {
  return {
    account,
    opening: balanceAt(ledger.postings, account, dayBefore(period.from)),
    closing: balanceAt(ledger.postings, account, period.to),
    rows: statement(ledger.postings, account, period.from, period.to),
  };
}

/** The ISO day before another, on the calendar. */
function dayBefore(iso: string): string {
  const date = parseDayTitle(iso);
  return date ? formatDayTitle(addDays(date, -1)) : iso;
}
