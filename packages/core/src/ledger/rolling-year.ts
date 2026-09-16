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
 * the difference. And what is held at each month end: measured for a closed
 * month, and for an open one carried forward from the last measured balance by
 * the planned postings.
 *
 * **A budget line is a planned posting.** Its `via` names the other account:
 * the account an expense is paid from, an income received into, a transfer
 * taken out of. Which side is debited follows from the named account's kind,
 * as in the journal. A line with no `via` (and a note with no default) still
 * moves net worth, so its effect goes to `unassigned` rather than nowhere: the
 * projected accounts plus `unassigned` always make the projected net worth,
 * which is the result carried forward and needs no account at all.
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

/**
 * One asset or liability account's balances: measured at a closed month's end,
 * projected by the planned postings after it. `RollingYear.closedThrough` says
 * which months are which.
 */
export interface RollingBalanceAccount {
  account: Account;
  /** The balance on the last day of the previous year. */
  opening: number;
  months: number[];
  inTotal: boolean;
}

export interface RollingBalanceGroup {
  name: string;
  path: string;
  accounts: RollingBalanceAccount[];
  children: RollingBalanceGroup[];
  opening: number;
  months: number[];
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
  /**
   * What the plan moves in net worth without saying which account: lines with
   * no `via`, or a `via` that is not an asset or liability. Zero in closed
   * months, cumulative after. Assets less liabilities plus this is `net`.
   */
  unassigned: number[];
  /**
   * Account numbers a budget line names, as `account` or `via`, that the chart
   * does not have (or, for `via`, that is not an asset or liability).
   */
  strayLines: number[];
}

export interface RollingYearOptions {
  /** Omit for a single-currency vault. Plans are taken to be in the reporting currency already. */
  convert?: Converter;
  /** The budget note's own `via`: used by a line that names none. */
  via?: number | null;
}

const isBalanceKind = (account: Account | undefined): boolean =>
  account?.kind === 'asset' || account?.kind === 'liability';

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
  const defaultVia = options.via ?? null;

  // Planned postings, as their effect on each balance account's balance per
  // month, and on net worth where the other side names no balance account.
  const planned = new Map<number, number[]>();
  const unassignedMoves = zeros();
  const stray = new Set<number>();
  for (const line of lines) {
    const account = byNumber.get(line.account);
    if (!account) {
      stray.add(line.account);
      continue;
    }
    const via = line.via ?? defaultVia;
    const viaAccount = via === null ? undefined : byNumber.get(via);
    if (via !== null && !isBalanceKind(viaAccount)) stray.add(via);

    const amounts = expandBudgetLine(line);
    // The journal's rule read from the named account's side: an income is
    // credited to it, everything else is debited to it. The `via` account
    // takes the other side.
    const accountDebited = account.kind !== 'income';

    const move = (target: Account, debited: boolean) => {
      // A balance as the ledger states it: an asset grows on a debit, a
      // liability (a positive figure owed) shrinks on one.
      const grows = (target.kind === 'asset') === debited;
      const row = planned.get(target.number) ?? zeros();
      addInto(
        row,
        amounts.map((amount) => (grows ? amount : -amount))
      );
      planned.set(target.number, row);
    };

    if (isBalanceKind(account)) move(account, accountDebited);
    if (viaAccount && isBalanceKind(viaAccount)) {
      move(viaAccount, !accountDebited);
    } else {
      // The side that names no account still moves net worth: a debit to a
      // balance account adds to it, a credit takes from it, whether asset or
      // liability.
      const debited = !accountDebited;
      addInto(
        unassignedMoves,
        amounts.map((amount) => (debited ? amount : -amount))
      );
    }
  }
  const strayLines = [...stray].sort((a, b) => a - b);

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
    const opening = openingFigure === null ? 0 : roundCents(openingFigure);

    const moves = planned.get(account.number) ?? zeros();
    const months: number[] = [];
    let last = opening;
    for (let month = 1; month <= 12; month += 1) {
      if (month <= closed) {
        const value = figure(monthRange(year, month).to);
        if (value === null) inTotal = false;
        last = value === null ? 0 : roundCents(value);
      } else {
        last = roundCents(last + (moves[month - 1] ?? 0));
      }
      months.push(last);
    }

    const empty = opening === 0 && months.every((value) => value === 0);
    return empty && inTotal ? null : { account, opening, months, inTotal };
  };

  const assets = foldBalance(accountTree(accounts, 'asset'), balanceAccount);
  const liabilities = foldBalance(accountTree(accounts, 'liability'), balanceAccount);

  const netOpening = roundCents(assets.opening - liabilities.opening);
  const netMonths: number[] = [];
  const measured: boolean[] = [];
  const unassigned: number[] = [];
  let running = netOpening;
  let adrift = 0;
  for (let index = 0; index < 12; index += 1) {
    if (index < closed) {
      running = roundCents((assets.months[index] ?? 0) - (liabilities.months[index] ?? 0));
      measured.push(true);
    } else {
      // Projected as it always was, by the planned result, which needs no
      // account. The accounts and `unassigned` are then two ways of dividing
      // up this same figure, and the test suite holds them to it.
      running = roundCents(running + (resultPlan[index] ?? 0));
      adrift = roundCents(adrift + (unassignedMoves[index] ?? 0));
      measured.push(false);
    }
    netMonths.push(running);
    unassigned.push(index < closed ? 0 : adrift);
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
    unassigned,
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
  row: (account: Account) => RollingBalanceAccount | null
): RollingBalanceGroup {
  const accounts = group.accounts
    .map(row)
    .filter((entry): entry is RollingBalanceAccount => entry !== null);
  const children = group.children
    .map((child) => foldBalance(child, row))
    .filter((child) => child.accounts.length > 0 || child.children.length > 0);

  const entries = [...accounts, ...children];
  const opening = roundCents(entries.reduce((total, entry) => total + entry.opening, 0));
  const months = zeros();
  for (const entry of entries) addInto(months, entry.months);

  return { name: group.name, path: group.path, accounts, children, opening, months };
}
