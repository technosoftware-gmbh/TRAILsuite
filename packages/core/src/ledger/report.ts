/**
 * The two reports a household is actually judged by.
 *
 * `Gewinnermittlung`, what came in less what went out over a period, and
 * `Bestandeskonten`, what is held and what is owed on a day. Both are the
 * account tree with a figure on every account and a total on every group, which
 * is why they share one shape.
 *
 * Pure: a report is a function of the accounts, the postings and a period, and
 * computing one writes nothing.
 *
 * App-free, and clock-free.
 */
import { roundCents } from '../money/format.js';
import { accountTree, type AccountGroup } from './account.js';
import { balanceAt, movementBetween } from './balance.js';
import type { Account, AccountKind, Posting } from './types.js';

/** One account with the figure a report puts against it. */
export interface ReportAccount {
  account: Account;
  /**
   * In the reporting currency. This, and only this, is what the totals add.
   *
   * Zero for an account whose currency has no rate, which is what `inTotal`
   * says. Adding a foreign figure at face value is the failure this field
   * exists to prevent: 310 euro and 500 dollars are not 810 francs, and a
   * report that said so was wrong before any rate existed.
   */
  amount: number;
  /** What the account itself holds, in its own currency. */
  stated: number;
  /** False when no rate converts this account, so it contributes nothing above. */
  inTotal: boolean;
}

/** A group of the tree with its figures and its total. */
export interface ReportGroup {
  name: string;
  path: string;
  accounts: ReportAccount[];
  children: ReportGroup[];
  /** Everything beneath it, in the reporting currency. */
  total: number;
  /** How many accounts beneath it are missing from that total for want of a rate. */
  missing: number;
}

/**
 * Turns a figure in an account's own currency into the reporting currency.
 *
 * Null means there is no rate for it. The account keeps its own figure and adds
 * nothing to any total, and the report counts it as missing so a view can say
 * so. Returning zero instead would be a lie that adds up.
 */
export type Converter = (amount: number, currency: string | null) => number | null;

const SAME: Converter = (amount) => amount;

export interface ReportOptions {
  hideEmpty?: boolean;
  /** Omit for a single-currency vault, where every figure is already comparable. */
  convert?: Converter;
}

/**
 * One section of a report: everything of one kind, as a tree with totals.
 *
 * `figure` decides what the report is about. Movement over a period gives an
 * income statement; a balance on a day gives a balance sheet. The tree walking
 * and the totalling are the same either way, so they are written once.
 */
export function reportSection(
  accounts: readonly Account[],
  kind: AccountKind,
  figure: (account: Account) => number,
  options: ReportOptions = {}
): ReportGroup {
  return foldGroup(
    accountTree(accounts, kind),
    figure,
    options.hideEmpty ?? false,
    options.convert ?? SAME
  );
}

function foldGroup(
  group: AccountGroup,
  figure: (account: Account) => number,
  hideEmpty: boolean,
  convert: Converter
): ReportGroup {
  const accounts: ReportAccount[] = [];
  for (const account of group.accounts) {
    const stated = roundCents(figure(account));
    // An account with no movement is dropped only when asked. A yearly report
    // wants to show that the account exists and stayed at nothing; a monthly
    // one usually does not.
    if (hideEmpty && stated === 0) continue;

    const converted = convert(stated, account.currency);
    accounts.push({
      account,
      stated,
      amount: converted === null ? 0 : roundCents(converted),
      inTotal: converted !== null,
    });
  }

  const children = group.children
    .map((child) => foldGroup(child, figure, hideEmpty, convert))
    .filter((child) => !hideEmpty || child.total !== 0 || child.accounts.length > 0);

  const own = accounts.reduce((sum, entry) => sum + entry.amount, 0);
  const below = children.reduce((sum, child) => sum + child.total, 0);

  return {
    name: group.name,
    path: group.path,
    accounts,
    children,
    total: roundCents(own + below),
    missing:
      accounts.filter((entry) => !entry.inTotal).length +
      children.reduce((sum, child) => sum + child.missing, 0),
  };
}

/** What a household earned and spent over a period, and what is left. */
export interface IncomeStatement {
  from: string;
  to: string;
  income: ReportGroup;
  expense: ReportGroup;
  incomeTotal: number;
  expenseTotal: number;
  /** Income less expenses. Negative is a month that cost more than it earned. */
  result: number;
}

export function incomeStatement(
  accounts: readonly Account[],
  postings: readonly Posting[],
  from: string,
  to: string,
  options: ReportOptions = {}
): IncomeStatement {
  const figure = (account: Account): number => movementBetween(postings, account, from, to);
  const income = reportSection(accounts, 'income', figure, options);
  const expense = reportSection(accounts, 'expense', figure, options);

  return {
    from,
    to,
    income,
    expense,
    incomeTotal: income.total,
    expenseTotal: expense.total,
    result: roundCents(income.total - expense.total),
  };
}

/**
 * The same period, counted as money that actually left.
 *
 * An income statement says what a month cost: an invoice is an expense the day
 * it is incurred, whether or not it has been paid. That is the honest answer to
 * "what did January cost", and it is what double entry produces on its own.
 *
 * It is not the only question worth asking. A household carrying a tax
 * assessment over twelve instalments, or a credit card settled the month after
 * it was spent, also wants to know what actually went out of its accounts --
 * which is the figure a bank balance moves by, and the one an older cash-based
 * system reports.
 *
 * **Both come from the same postings.** Nothing is entered twice and nothing is
 * classified differently; this only counts a different subset. An expense
 * counts when the credit side is an asset, and a payment against a debt counts
 * under the liability it settles, because that is where the money went even
 * though no expense account was touched.
 *
 * A transfer between two of the household's own accounts is not spending and
 * never appears: both sides are assets.
 */
export interface CashOut {
  from: string;
  to: string;
  /** Expenses whose payment left an asset account in the period. */
  expense: ReportGroup;
  /** Debts paid down: card balances, tax instalments. */
  settled: ReportGroup;
  expenseTotal: number;
  settledTotal: number;
  /** Everything that left the household's accounts, however it was classified. */
  total: number;
}

export function cashOut(
  accounts: readonly Account[],
  postings: readonly Posting[],
  from: string,
  to: string,
  options: ReportOptions = {}
): CashOut {
  const kinds = new Map(accounts.map((account) => [account.number, account.kind]));
  const paid = new Map<number, number>();

  for (const posting of postings) {
    if (posting.date < from || posting.date > to) continue;
    if (posting.credit === null || posting.debit === null) continue;
    // Money leaving something the household holds.
    if (kinds.get(posting.credit) !== 'asset') continue;

    const against = kinds.get(posting.debit);
    if (against !== 'expense' && against !== 'liability') continue;
    paid.set(posting.debit, roundCents((paid.get(posting.debit) ?? 0) + posting.amount));
  }

  const figure = (account: Account): number => paid.get(account.number) ?? 0;
  const expense = reportSection(accounts, 'expense', figure, options);
  const settled = reportSection(accounts, 'liability', figure, options);

  return {
    from,
    to,
    expense,
    settled,
    expenseTotal: expense.total,
    settledTotal: settled.total,
    total: roundCents(expense.total + settled.total),
  };
}

/** What is held and what is owed on a day. */
export interface BalanceSheet {
  on: string | null;
  assets: ReportGroup;
  liabilities: ReportGroup;
  assetTotal: number;
  liabilityTotal: number;
  /** Assets less liabilities. Equity is not maintained anywhere; it is this. */
  net: number;
}

export function balanceSheet(
  accounts: readonly Account[],
  postings: readonly Posting[],
  on: string | null = null,
  options: ReportOptions = {}
): BalanceSheet {
  const figure = (account: Account): number => balanceAt(postings, account, on);
  const assets = reportSection(accounts, 'asset', figure, options);
  const liabilities = reportSection(accounts, 'liability', figure, options);

  return {
    on,
    assets,
    liabilities,
    assetTotal: assets.total,
    liabilityTotal: liabilities.total,
    net: roundCents(assets.total - liabilities.total),
  };
}

/**
 * Every account in a report section, flattened, in the order it prints.
 *
 * For the callers that want rows rather than a tree: a CSV export, a table, a
 * check that walks every figure.
 */
export function flattenReport(group: ReportGroup): ReportAccount[] {
  return [...group.accounts, ...group.children.flatMap((child) => flattenReport(child))];
}
