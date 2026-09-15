/**
 * A budget year as a household runs one: planned in January, and replaced by
 * what happened one month at a time.
 *
 * The shape comes from the spreadsheet this replaces. One column per month.
 * Every month already closed shows what the ledger says happened; every month
 * still to come shows the plan. In January the year is pure plan; at the start
 * of February January is replaced by reality, and the total then says whether
 * the rest of the year still works. That is a different question from "was
 * March over budget", which `measureBudgetMonth` answers, and it is the one a
 * year is steered by.
 *
 * **A month is closed by somebody saying so**, which is `closedThrough` on the
 * budget note, not by the calendar. On the second of February January's
 * statements are usually not imported yet, and a sheet that showed a
 * half-booked January as reality would be telling the household it had money
 * it has already spent.
 *
 * **Two halves.** What came in and went out per month, by the chart's groups,
 * with the forecast (actual so far, plan for the rest), the untouched plan and
 * the difference. And what is held at each month end: exact for closed months,
 * and for open months only as a total. The total can be projected exactly,
 * because in double entry the net worth moves by the result and by nothing
 * else. A single account cannot: a budget line names what money is spent on,
 * not which account pays it, so per-account projection waits for a budget line
 * that can name its counter-account.
 *
 * App-free, and clock-free.
 */
import { roundCents } from '../money/format.js';
import { accountTree, type AccountGroup } from './account.js';
import {
  clampClosedThrough,
  expandBudgetLine,
  monthRange,
  type AccountBudgetLine,
} from './account-budget.js';
import { balanceAt, movementBetween } from './balance.js';
import type { Converter } from './report.js';
import type { Account, Posting } from './types.js';

const SAME: Converter = (amount) => amount;

const zeros = (): number[] => new Array<number>(12).fill(0);
const sum = (values: readonly number[]): number =>
  roundCents(values.reduce((total, value) => total + value, 0));
const addInto = (target: number[], values: readonly number[]): void => {
  for (let index = 0; index < 12; index += 1) {
    target[index] = roundCents((target[index] ?? 0) + (values[index] ?? 0));
  }
};

/** One income or expense account across the year. Every figure in the reporting currency. */
export interface RollingAccount {
  account: Account;
  /** Twelve figures: what happened in a closed month, the plan in an open one. */
  forecast: number[];
  /** Twelve figures: the plan as made, closed months included. */
  plan: number[];
  forecastTotal: number;
  planTotal: number;
  /**
   * Forecast less plan. More income than planned is positive; so is more
   * spending, which a sheet showing expenses as negative figures turns into
   * the negative it is.
   */
  variance: number;
  /** False when the account's currency has no rate: its actual months count as nothing. */
  inTotal: boolean;
  /** Whether a budget line names it. An unbudgeted account with movement is shown, not hidden. */
  budgeted: boolean;
}

export interface RollingGroup {
  name: string;
  path: string;
  accounts: RollingAccount[];
  children: RollingGroup[];
  forecast: number[];
  plan: number[];
  forecastTotal: number;
  planTotal: number;
  variance: number;
  /** Accounts beneath it whose actual months are missing for want of a rate. */
  missing: number;
}

/** One asset or liability account's balances. Null in a month that is not closed. */
export interface RollingBalanceAccount {
  account: Account;
  /** The balance on the last day of the previous year. */
  opening: number;
  months: (number | null)[];
  inTotal: boolean;
}

export interface RollingBalanceGroup {
  name: string;
  path: string;
  accounts: RollingBalanceAccount[];
  children: RollingBalanceGroup[];
  opening: number;
  months: (number | null)[];
}

/** Income less expense per month. */
export interface RollingResult {
  forecast: number[];
  plan: number[];
  forecastTotal: number;
  planTotal: number;
  variance: number;
}

export interface RollingYear {
  year: number;
  /** 0 to 12: the months that show what happened. */
  closedThrough: number;
  income: RollingGroup;
  expense: RollingGroup;
  result: RollingResult;
  assets: RollingBalanceGroup;
  liabilities: RollingBalanceGroup;
  /**
   * Assets less liabilities: at the end of the previous year, and at each
   * month end. Measured for a closed month, projected by the planned result
   * for an open one; `measured` says which.
   */
  net: { opening: number; months: number[]; measured: boolean[] };
  /** Account numbers a budget line names that are not an income or expense account in the chart. */
  strayLines: number[];
}

export interface RollingYearOptions {
  /** Omit for a single-currency vault. Plans are taken to be in the reporting currency already. */
  convert?: Converter;
}

export function rollingYear(
  lines: readonly AccountBudgetLine[],
  accounts: readonly Account[],
  postings: readonly Posting[],
  year: number,
  closedThrough: number,
  options: RollingYearOptions = {}
): RollingYear {
  const closed = clampClosedThrough(closedThrough);
  const convert = options.convert ?? SAME;

  // Several lines may budget one account (two premiums on one insurance
  // account); what the sheet shows is the account.
  const planByAccount = new Map<number, number[]>();
  for (const line of lines) {
    const months = planByAccount.get(line.account) ?? zeros();
    addInto(months, expandBudgetLine(line));
    planByAccount.set(line.account, months);
  }

  const byNumber = new Map(accounts.map((account) => [account.number, account]));
  const strayLines = [...planByAccount.keys()]
    .filter((number) => {
      const kind = byNumber.get(number)?.kind;
      return kind !== 'income' && kind !== 'expense';
    })
    .sort((a, b) => a - b);

  const flowAccount = (account: Account): RollingAccount | null => {
    const planned = planByAccount.get(account.number) ?? zeros();
    const forecast = [...planned];
    let inTotal = true;
    let moved = false;

    for (let month = 1; month <= closed; month += 1) {
      const { from, to } = monthRange(year, month);
      const stated = movementBetween(postings, account, from, to);
      if (stated !== 0) moved = true;
      const converted = convert(stated, account.currency);
      if (converted === null && stated !== 0) inTotal = false;
      forecast[month - 1] = converted === null ? 0 : roundCents(converted);
    }

    const budgeted = planByAccount.has(account.number);
    // An account nobody planned and nothing touched says nothing about the
    // year. One with movement and no plan is the most interesting row there
    // is, which is why `moved` keeps it.
    if (!budgeted && !moved) return null;

    const forecastTotal = sum(forecast);
    const planTotal = sum(planned);
    return {
      account,
      forecast,
      plan: [...planned],
      forecastTotal,
      planTotal,
      variance: roundCents(forecastTotal - planTotal),
      inTotal,
      budgeted,
    };
  };

  const income = foldFlow(accountTree(accounts, 'income'), flowAccount);
  const expense = foldFlow(accountTree(accounts, 'expense'), flowAccount);

  const resultOf = (a: readonly number[], b: readonly number[]): number[] =>
    a.map((value, index) => roundCents(value - (b[index] ?? 0)));
  const resultForecast = resultOf(income.forecast, expense.forecast);
  const resultPlan = resultOf(income.plan, expense.plan);
  const result: RollingResult = {
    forecast: resultForecast,
    plan: resultPlan,
    forecastTotal: sum(resultForecast),
    planTotal: sum(resultPlan),
    variance: roundCents(sum(resultForecast) - sum(resultPlan)),
  };

  const yearEnd = `${year - 1}-12-31`;
  const balanceAccount = (account: Account): RollingBalanceAccount | null => {
    // A balance of nothing is nothing in any currency, so only a real figure
    // with no rate counts as missing.
    const figure = (on: string): number | null => {
      const stated = balanceAt(postings, account, on);
      return stated === 0 ? 0 : convert(stated, account.currency);
    };

    let inTotal = true;
    const openingFigure = figure(yearEnd);
    if (openingFigure === null) inTotal = false;
    const months: (number | null)[] = new Array<number | null>(12).fill(null);
    for (let month = 1; month <= closed; month += 1) {
      const value = figure(monthRange(year, month).to);
      if (value === null) inTotal = false;
      months[month - 1] = value === null ? 0 : roundCents(value);
    }

    const opening = openingFigure === null ? 0 : roundCents(openingFigure);
    const empty = opening === 0 && months.every((value) => value === null || value === 0);
    return empty && inTotal ? null : { account, opening, months, inTotal };
  };

  const assets = foldBalance(accountTree(accounts, 'asset'), balanceAccount, closed);
  const liabilities = foldBalance(accountTree(accounts, 'liability'), balanceAccount, closed);

  const netOpening = roundCents(assets.opening - liabilities.opening);
  const netMonths: number[] = [];
  const measured: boolean[] = [];
  let running = netOpening;
  for (let index = 0; index < 12; index += 1) {
    if (index < closed) {
      running = roundCents((assets.months[index] ?? 0) - (liabilities.months[index] ?? 0));
      measured.push(true);
    } else {
      running = roundCents(running + (resultPlan[index] ?? 0));
      measured.push(false);
    }
    netMonths.push(running);
  }

  return {
    year,
    closedThrough: closed,
    income,
    expense,
    result,
    assets,
    liabilities,
    net: { opening: netOpening, months: netMonths, measured },
    strayLines,
  };
}

function foldFlow(
  group: AccountGroup,
  row: (account: Account) => RollingAccount | null
): RollingGroup {
  const accounts = group.accounts
    .map(row)
    .filter((entry): entry is RollingAccount => entry !== null);
  const children = group.children
    .map((child) => foldFlow(child, row))
    .filter((child) => child.accounts.length > 0 || child.children.length > 0);

  const forecast = zeros();
  const plan = zeros();
  for (const entry of [...accounts, ...children]) {
    addInto(forecast, entry.forecast);
    addInto(plan, entry.plan);
  }
  const forecastTotal = sum(forecast);
  const planTotal = sum(plan);

  return {
    name: group.name,
    path: group.path,
    accounts,
    children,
    forecast,
    plan,
    forecastTotal,
    planTotal,
    variance: roundCents(forecastTotal - planTotal),
    missing:
      accounts.filter((entry) => !entry.inTotal).length +
      children.reduce((total, child) => total + child.missing, 0),
  };
}

function foldBalance(
  group: AccountGroup,
  row: (account: Account) => RollingBalanceAccount | null,
  closed: number
): RollingBalanceGroup {
  const accounts = group.accounts
    .map(row)
    .filter((entry): entry is RollingBalanceAccount => entry !== null);
  const children = group.children
    .map((child) => foldBalance(child, row, closed))
    .filter((child) => child.accounts.length > 0 || child.children.length > 0);

  const entries = [...accounts, ...children];
  const opening = roundCents(entries.reduce((total, entry) => total + entry.opening, 0));
  const months: (number | null)[] = new Array<number | null>(12).fill(null);
  for (let index = 0; index < closed; index += 1) {
    months[index] = roundCents(
      entries.reduce((total, entry) => total + (entry.months[index] ?? 0), 0)
    );
  }

  return { name: group.name, path: group.path, accounts, children, opening, months };
}
