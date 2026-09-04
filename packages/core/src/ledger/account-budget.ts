/**
 * A budget keyed to accounts, planned by rhythm and read by the month.
 *
 * The problem this exists to solve is stated plainly: a budget that is yearly
 * only cannot be checked, because nobody lives a year at a time. A budget that
 * asks for twelve figures for each of fifty accounts is six hundred numbers a
 * year, which is a different way of going unused.
 *
 * Almost every household cost has a rhythm. Electricity is monthly, the water
 * bill quarterly, the car insurance falls once in March. So a line carries one
 * amount and its rhythm, and the twelve monthly figures are derived. Fifty
 * numbers a year, and a month you can still hold the spending up against.
 *
 * App-free, and clock-free.
 */
import { pad2 } from '../dates/day.js';
import { readNumberLike, readString } from '../frontmatter/read.js';
import { normalizeCurrency, roundCents } from '../money/format.js';
import { movementBetween } from './balance.js';
import type { Account, Posting } from './types.js';

/** How often a budgeted amount falls. The same vocabulary the recurring costs use. */
export const BUDGET_RHYTHMS = [
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'once',
] as const;
export type BudgetRhythm = (typeof BUDGET_RHYTHMS)[number];

export function isBudgetRhythm(value: unknown): value is BudgetRhythm {
  return typeof value === 'string' && (BUDGET_RHYTHMS as readonly string[]).includes(value);
}

/** One budgeted account. */
export interface AccountBudgetLine {
  account: number;
  /** What one occurrence costs. */
  amount: number;
  rhythm: BudgetRhythm;
  /** 1 to 12. Which month a rhythm that skips months falls in first. Defaults to January. */
  startMonth: number | null;
  note: string;
  /**
   * Month number to the figure that replaces whatever the rhythm implies.
   *
   * For where reality departs from the rhythm: the premium that rises in July,
   * the month the holiday falls in. Nobody has to use them, and a line with
   * none behaves exactly as its rhythm says.
   */
  overrides: Readonly<Record<number, number>>;
}

/** How many months apart a rhythm falls, or null for the ones that do not repeat. */
function strideOf(rhythm: BudgetRhythm): number | null {
  switch (rhythm) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'semiannual':
      return 6;
    default:
      return null;
  }
}

/**
 * One line as twelve monthly figures, January first.
 *
 * **A weekly amount is spread rather than counted.** Four weeks fall in some
 * months and five in others, and a budget that swung by a fifth depending on
 * how the weekdays landed would be noise. So a weekly line contributes
 * `amount * 52 / 12` every month, and the year comes out exactly right.
 */
export function expandBudgetLine(line: AccountBudgetLine): number[] {
  const months = new Array<number>(12).fill(0);
  const start = clampMonth(line.startMonth ?? 1);

  if (line.rhythm === 'weekly') {
    const monthly = roundCents((line.amount * 52) / 12);
    months.fill(monthly);
  } else {
    const stride = strideOf(line.rhythm);
    if (stride === null) {
      // annual and once: one hit, in the month it was said to fall in.
      months[start - 1] = line.amount;
    } else {
      for (let month = start; month <= 12; month += stride) months[month - 1] = line.amount;
      // A rhythm starting mid-year still falls in the earlier months of the
      // next year, and a year read on its own has to show that.
      for (let month = start - stride; month >= 1; month -= stride) months[month - 1] = line.amount;
    }
  }

  for (const [key, value] of Object.entries(line.overrides)) {
    const month = Number(key);
    if (month >= 1 && month <= 12) months[month - 1] = roundCents(value);
  }

  return months.map(roundCents);
}

/** One row of the year overview: the account, its twelve figures, and the year. */
export interface BudgetYearRow {
  line: AccountBudgetLine;
  months: number[];
  total: number;
}

/** The year overview: accounts down, months across. The starting point. */
export function budgetYear(lines: readonly AccountBudgetLine[]): {
  rows: BudgetYearRow[];
  monthTotals: number[];
  total: number;
} {
  const rows = lines.map((line) => {
    const months = expandBudgetLine(line);
    return { line, months, total: roundCents(months.reduce((sum, value) => sum + value, 0)) };
  });

  const monthTotals = new Array<number>(12).fill(0);
  for (const row of rows) {
    for (let index = 0; index < 12; index += 1) {
      monthTotals[index] = roundCents((monthTotals[index] ?? 0) + (row.months[index] ?? 0));
    }
  }

  return {
    rows,
    monthTotals,
    total: roundCents(rows.reduce((sum, row) => sum + row.total, 0)),
  };
}

/** One budgeted account measured against what actually happened. */
export interface BudgetMeasureRow {
  account: Account | null;
  number: number;
  planned: number;
  actual: number;
  /** Planned less actual. Negative is over. */
  left: number;
  note: string;
}

/** A month measured: every budgeted account, and everything no line claimed. */
export interface BudgetMeasure {
  year: number;
  month: number;
  from: string;
  to: string;
  rows: BudgetMeasureRow[];
  unbudgeted: BudgetMeasureRow[];
  plannedTotal: number;
  actualTotal: number;
}

/** The first and last day of a month, as the ISO days everything here compares. */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
}

/**
 * One month of a budget held up against the postings.
 *
 * **What no line claimed is shown, not hidden.** An expense account with
 * spending on it and no budget line is the most interesting row on the page,
 * and a report that quietly left it out would be a report that flatters.
 */
export function measureBudgetMonth(
  lines: readonly AccountBudgetLine[],
  accounts: readonly Account[],
  postings: readonly Posting[],
  year: number,
  month: number
): BudgetMeasure {
  const { from, to } = monthRange(year, month);
  const byNumber = new Map(accounts.map((account) => [account.number, account]));
  const index = clampMonth(month) - 1;

  const rows: BudgetMeasureRow[] = lines.map((line) => {
    const account = byNumber.get(line.account) ?? null;
    const planned = expandBudgetLine(line)[index] ?? 0;
    const actual = account ? movementBetween(postings, account, from, to) : 0;
    return {
      account,
      number: line.account,
      planned,
      actual,
      left: roundCents(planned - actual),
      note: line.note,
    };
  });

  const claimed = new Set(lines.map((line) => line.account));
  const unbudgeted: BudgetMeasureRow[] = [];
  for (const account of accounts) {
    if (account.kind !== 'expense' || claimed.has(account.number)) continue;
    const actual = movementBetween(postings, account, from, to);
    if (actual === 0) continue;
    unbudgeted.push({
      account,
      number: account.number,
      planned: 0,
      actual,
      left: roundCents(-actual),
      note: '',
    });
  }

  return {
    year,
    month,
    from,
    to,
    rows,
    unbudgeted: unbudgeted.sort((a, b) => a.number - b.number),
    plannedTotal: roundCents(rows.reduce((sum, row) => sum + row.planned, 0)),
    actualTotal: roundCents([...rows, ...unbudgeted].reduce((sum, row) => sum + row.actual, 0)),
  };
}

function clampMonth(month: number): number {
  if (!Number.isFinite(month)) return 1;
  return Math.min(12, Math.max(1, Math.round(month)));
}

// The note ----------------------------------------------------------------

export interface AccountBudgetProperties {
  typePropertyName: string;
  typeValue: string;
  /** The year this budget is for. */
  periodProperty: string;
  currencyProperty: string;
  linesProperty: string;
  lineAccountField: string;
  lineAmountField: string;
  lineRhythmField: string;
  lineMonthField: string;
  lineNoteField: string;
  /** A map of month number to amount, for where reality departs from the rhythm. */
  lineOverridesField: string;
}

export interface ParsedAccountBudget {
  /** `2026`. One note a year, because the rhythm is what makes the months. */
  period: string | null;
  currency: string | null;
  lines: AccountBudgetLine[];
}

/** A budget note paired with the file it came from. */
export interface AccountBudgetRecord<F> extends ParsedAccountBudget {
  file: F;
  title: string;
}

/**
 * One budget note read.
 *
 * A line with no account is dropped rather than kept as a catch-all. The whole
 * point of keying a budget to accounts is that every figure has somewhere to be
 * measured against, and a line naming nothing can never be measured at all.
 */
export function parseAccountBudget(
  frontmatter: Record<string, unknown>,
  properties: AccountBudgetProperties
): ParsedAccountBudget {
  const p = properties;
  const raw = frontmatter[p.linesProperty];
  const list = Array.isArray(raw) ? raw : [];

  const lines: AccountBudgetLine[] = [];
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;

    const account = readNumberLike(record[p.lineAccountField]);
    if (account === null) continue;

    const rhythm = readString(record[p.lineRhythmField]);
    lines.push({
      account,
      amount: roundCents(readNumberLike(record[p.lineAmountField]) ?? 0),
      rhythm: isBudgetRhythm(rhythm) ? rhythm : 'monthly',
      startMonth: readNumberLike(record[p.lineMonthField]),
      note: readString(record[p.lineNoteField]) ?? '',
      overrides: readOverrides(record[p.lineOverridesField]),
    });
  }

  return {
    period: readString(frontmatter[p.periodProperty]),
    currency: normalizeCurrency(readString(frontmatter[p.currencyProperty])),
    lines,
  };
}

function readOverrides(value: unknown): Record<number, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const overrides: Record<number, number> = {};
  for (const [key, amount] of Object.entries(value as Record<string, unknown>)) {
    const month = Number(key);
    const figure = readNumberLike(amount);
    if (Number.isInteger(month) && month >= 1 && month <= 12 && figure !== null) {
      overrides[month] = roundCents(figure);
    }
  }
  return overrides;
}

/**
 * The frontmatter a budget note is written with.
 *
 * A field is omitted when it says nothing: a line with no note and no overrides
 * writes neither, so a hand edited budget stays as short as the person left it.
 */
export function buildAccountBudgetFrontmatter(
  properties: AccountBudgetProperties,
  budget: ParsedAccountBudget
): Record<string, unknown> {
  const p = properties;
  return {
    [p.typePropertyName]: p.typeValue,
    [p.periodProperty]: budget.period ?? '',
    [p.currencyProperty]: budget.currency ?? '',
    [p.linesProperty]: budget.lines.map((line) => ({
      [p.lineAccountField]: line.account,
      [p.lineAmountField]: line.amount,
      [p.lineRhythmField]: line.rhythm,
      ...(line.startMonth === null ? {} : { [p.lineMonthField]: line.startMonth }),
      ...(line.note ? { [p.lineNoteField]: line.note } : {}),
      ...(Object.keys(line.overrides).length > 0
        ? { [p.lineOverridesField]: { ...line.overrides } }
        : {}),
    })),
  };
}

/**
 * The year a budget note is for, or null.
 *
 * **A bare year and nothing else.** `2026-08` is refused rather than read as
 * 2026, because a budget note is one a year now and a note whose period names a
 * month was written under the older shape. Accepting it would let a note with
 * no readable lines present itself as the year's budget and report a plan of
 * nothing, which reads exactly like a year somebody has not budgeted yet.
 */
export function budgetYearOf(budget: ParsedAccountBudget): number | null {
  const period = budget.period?.trim() ?? '';
  return /^\d{4}$/.test(period) ? Number(period) : null;
}
